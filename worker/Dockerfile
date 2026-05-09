# syntax=docker/dockerfile:1
# Multi-stage build: compile a static binary in golang-alpine, then copy
# it into a distroless runtime image. Mirrors backend/Dockerfile so both
# images share the same security posture.

FROM --platform=$BUILDPLATFORM golang:1.25-alpine AS build
ARG TARGETOS
ARG TARGETARCH
WORKDIR /src
# Copy module files first so dependency download caches independently of
# source changes.
COPY worker/go.mod worker/go.sum ./
RUN go mod download
COPY worker/ ./
RUN CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH} \
    go build -trimpath -ldflags="-s -w" -o /out/dear-baby-worker ./cmd/worker

FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /
COPY --from=build /out/dear-baby-worker /dear-baby-worker
USER nonroot:nonroot
ENTRYPOINT ["/dear-baby-worker"]
