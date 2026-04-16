# syntax=docker/dockerfile:1
FROM --platform=$BUILDPLATFORM golang:1.22-alpine AS build
ARG TARGETOS
ARG TARGETARCH
WORKDIR /src
COPY backend/go.mod ./
RUN go mod download
COPY backend/ ./
RUN CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH} \
    go build -trimpath -ldflags="-s -w" -o /out/dear-baby-backend ./

FROM gcr.io/distroless/static-debian12:debug-nonroot
WORKDIR /
COPY --from=build /out/dear-baby-backend /dear-baby-backend
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/dear-baby-backend"]
