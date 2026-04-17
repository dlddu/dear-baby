# syntax=docker/dockerfile:1
FROM --platform=$BUILDPLATFORM golang:1.22-alpine AS build
ARG TARGETOS
ARG TARGETARCH
WORKDIR /src
COPY backend/go.mod ./
RUN go mod download
COPY backend/ ./
RUN CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH} \
    go build -trimpath -ldflags="-s -w" -o /out/dear-baby-backend ./cmd/server && \
    CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH} \
    go build -trimpath -ldflags="-s -w" -o /out/reset-onboarding ./cmd/reset-onboarding

FROM gcr.io/distroless/static-debian12:debug-nonroot
WORKDIR /
COPY --from=build /out/dear-baby-backend /dear-baby-backend
COPY --from=build /out/reset-onboarding /reset-onboarding
COPY --chmod=0755 backend/scripts/ /scripts/
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/dear-baby-backend"]
