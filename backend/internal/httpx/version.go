package httpx

import "net/http"

// APIVersion is the URL-path version segment for the public HTTP API.
// All authenticated/business routes are mounted under "/" + APIVersion;
// only operational endpoints like /health stay unversioned so that
// k8s probes, CI smoke tests, and the landing screen continue to hit
// stable paths across version bumps.
const APIVersion = "v1"

// APIVersionPrefix is the URL prefix used by the chi router and clients
// when building versioned paths. It includes the leading slash and no
// trailing slash so it can be string-concatenated with sub-paths.
const APIVersionPrefix = "/" + APIVersion

// APIVersionHeader is the response header advertising which API version
// served the request. Clients can pin/log it; ops can spot stale
// deployments without parsing routes.
const APIVersionHeader = "X-API-Version"

// APIVersionResponse stamps every response with the X-API-Version
// header. Mounting it at the router root means /health and future
// unversioned endpoints get the header too, which is the correct
// signal: the running binary speaks vN, regardless of the path.
func APIVersionResponse() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set(APIVersionHeader, APIVersion)
			next.ServeHTTP(w, r)
		})
	}
}
