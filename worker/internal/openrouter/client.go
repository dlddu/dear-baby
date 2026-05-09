// Package openrouter wraps the OpenRouter Go SDK with two project
// specific concerns: a small request/response surface so callers don't
// have to learn the SDK's union types, and an OTel span around each
// chat completion that follows the GenAI semantic conventions Langfuse
// renders natively.
package openrouter

import (
	"context"
	"errors"
	"fmt"
	"strings"

	openrouter "github.com/OpenRouterTeam/go-sdk"
	"github.com/OpenRouterTeam/go-sdk/models/components"
	"github.com/OpenRouterTeam/go-sdk/optionalnullable"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

// DefaultBaseURL is the OpenRouter production endpoint. Tests and CI
// override this via OPENROUTER_BASE_URL so they hit a local mock rather
// than spending real credits.
const DefaultBaseURL = "https://openrouter.ai/api/v1"

// tracerName is the otel.Tracer name spans are bucketed under. Stable
// because dashboards filter on it.
const tracerName = "github.com/dlddu/dear-baby/worker/internal/openrouter"

// Role values mirror the strings the SDK expects on the wire. Defining
// them here keeps task code free of openrouter SDK imports.
const (
	RoleSystem = "system"
	RoleUser   = "user"
)

// Message is the role+content pair tasks build up. We deliberately don't
// expose tool calls or attachments yet — the only task today (ai_preview)
// is text-only.
type Message struct {
	Role    string
	Content string
}

// ChatRequest is the slice of OpenRouter's surface area we currently use.
// Add fields here as new tasks need them rather than threading the SDK's
// ChatRequest through every layer.
type ChatRequest struct {
	Model     string
	Messages  []Message
	MaxTokens int64
}

// ChatResponse strips the assistant choice down to fields the worker
// actually consumes. Token counts are exposed so future tasks can surface
// usage without re-walking the SDK response.
type ChatResponse struct {
	Content      string
	Model        string
	ID           string
	FinishReason string
	InputTokens  int64
	OutputTokens int64
}

// Client holds the SDK handle and the tracer used to instrument each
// call. Construct one per worker process; the SDK is goroutine-safe.
type Client struct {
	sdk    *openrouter.OpenRouter
	tracer trace.Tracer
}

// New returns a configured client. baseURL is optional; when empty we
// fall through to DefaultBaseURL. The API key is required and the SDK
// surfaces a clear error if a request is made without one, so we don't
// double-validate here.
func New(apiKey, baseURL string) *Client {
	if strings.TrimSpace(baseURL) == "" {
		baseURL = DefaultBaseURL
	}
	sdk := openrouter.New(
		openrouter.WithSecurity(apiKey),
		openrouter.WithServerURL(baseURL),
	)
	return &Client{
		sdk:    sdk,
		tracer: otel.Tracer(tracerName),
	}
}

// Send issues a non-streaming chat completion. The request rides under a
// span tagged with GenAI semantic conventions so Langfuse renders the
// trace as a "generation" without any extra attributes from the caller.
func (c *Client) Send(ctx context.Context, req ChatRequest) (ChatResponse, error) {
	ctx, span := c.tracer.Start(ctx, "chat "+req.Model, trace.WithAttributes(
		attribute.String("gen_ai.system", "openrouter"),
		attribute.String("gen_ai.operation.name", "chat"),
		attribute.String("gen_ai.request.model", req.Model),
		attribute.Int64("gen_ai.request.max_tokens", req.MaxTokens),
	))
	defer span.End()

	msgs, err := buildMessages(req.Messages)
	if err != nil {
		recordErr(span, err)
		return ChatResponse{}, err
	}

	body := components.ChatRequest{
		Model:    openrouter.String(req.Model),
		Messages: msgs,
	}
	if req.MaxTokens > 0 {
		body.MaxTokens = optionalnullable.From(openrouter.Pointer[int64](req.MaxTokens))
	}

	resp, err := c.sdk.Chat.Send(ctx, body)
	if err != nil {
		recordErr(span, err)
		return ChatResponse{}, fmt.Errorf("openrouter send: %w", err)
	}
	if resp == nil || resp.ChatResult == nil {
		// Stream defaults to false so the SDK should always return a
		// ChatResult. Treat anything else as a malformed response rather
		// than panic on a nil pointer downstream.
		err := errors.New("openrouter returned no chat result")
		recordErr(span, err)
		return ChatResponse{}, err
	}

	out, err := readChoice(resp.ChatResult)
	if err != nil {
		recordErr(span, err)
		return ChatResponse{}, err
	}

	span.SetAttributes(
		attribute.String("gen_ai.response.id", out.ID),
		attribute.String("gen_ai.response.model", out.Model),
		attribute.Int64("gen_ai.usage.input_tokens", out.InputTokens),
		attribute.Int64("gen_ai.usage.output_tokens", out.OutputTokens),
	)
	if out.FinishReason != "" {
		span.SetAttributes(attribute.StringSlice(
			"gen_ai.response.finish_reasons", []string{out.FinishReason},
		))
	}
	return out, nil
}

func buildMessages(in []Message) ([]components.ChatMessages, error) {
	if len(in) == 0 {
		return nil, errors.New("openrouter: messages is empty")
	}
	out := make([]components.ChatMessages, 0, len(in))
	for i, m := range in {
		switch m.Role {
		case RoleSystem:
			out = append(out, components.CreateChatMessagesSystem(components.ChatSystemMessage{
				Role:    components.ChatSystemMessageRoleSystem,
				Content: components.CreateChatSystemMessageContentStr(m.Content),
			}))
		case RoleUser:
			out = append(out, components.CreateChatMessagesUser(components.ChatUserMessage{
				Role:    components.ChatUserMessageRoleUser,
				Content: components.CreateChatUserMessageContentStr(m.Content),
			}))
		default:
			return nil, fmt.Errorf("openrouter: unsupported role %q at index %d", m.Role, i)
		}
	}
	return out, nil
}

func readChoice(cr *components.ChatResult) (ChatResponse, error) {
	if len(cr.Choices) == 0 {
		return ChatResponse{}, errors.New("openrouter: response has no choices")
	}
	choice := cr.Choices[0]
	out := ChatResponse{
		ID:    cr.ID,
		Model: cr.Model,
	}
	if cv, ok := choice.Message.Content.GetOrZero(); ok {
		// The assistant content union supports several shapes; tasks only
		// need the plain string variant. Anything else is treated as
		// empty so the caller can detect it and publish an error.
		if cv.Type == components.ChatAssistantMessageContentTypeStr && cv.Str != nil {
			out.Content = *cv.Str
		}
	}
	if choice.FinishReason != nil {
		out.FinishReason = string(*choice.FinishReason)
	}
	if cr.Usage != nil {
		out.InputTokens = cr.Usage.PromptTokens
		out.OutputTokens = cr.Usage.CompletionTokens
	}
	return out, nil
}

func recordErr(span trace.Span, err error) {
	span.RecordError(err)
	span.SetStatus(codes.Error, err.Error())
}
