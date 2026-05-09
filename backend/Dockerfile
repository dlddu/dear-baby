# syntax=docker/dockerfile:1
# Multi-stage build: compile static binaries in golang-alpine, then copy
# them into a distroless runtime image. Build context is the backend
# directory itself — the backend is self-contained and doesn't need
# anything from the repo root.
FROM --platform=$BUILDPLATFORM golang:1.24-alpine AS build
ARG TARGETOS
ARG TARGETARCH
WORKDIR /src
COPY go.mod ./
RUN go mod download
COPY . ./
RUN CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH} \
    go build -trimpath -ldflags="-s -w" -o /out/dear-baby-backend ./cmd/server && \
    CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH} \
    go build -trimpath -ldflags="-s -w" -o /out/reset-onboarding ./cmd/reset-onboarding

FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /
COPY --from=build /out/dear-baby-backend /dear-baby-backend
COPY --from=build /out/reset-onboarding /reset-onboarding
COPY --chmod=0755 scripts/ /scripts/
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/dear-baby-backend"]
