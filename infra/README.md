# UmeTV infrastructure

## Redis
The current realtime server is intentionally single-instance. Redis is required before running multiple realtime instances. The final migration must move matchmaking, presence, rate limits, game/session coordination and Socket.IO pub/sub to Redis.

Never expose Redis publicly. Use authentication, private networking, TLS, backups and monitoring.

## TURN
The included coturn service exposes UDP/TCP 3478 and TLS 5349 with a constrained relay range. For production, use a stable public IP/DNS, a real TLS certificate, firewall rules for the relay range, and secret credentials. Put the resulting TURN servers into TURN_SERVERS.

## App Check
Configure the Firebase web App Check provider/site key first, then enable REQUIRE_APP_CHECK=true.

## Production topology
Browser -> load balancer -> UmeTV realtime nodes -> Redis
Browser <-> WebRTC <-> TURN

Until Redis shared-state support is enabled, keep exactly one realtime application instance.
