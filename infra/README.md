# UmeTV infrastructure

## Redis
The current realtime server is intentionally single-instance. Redis is required before running multiple realtime instances. The final migration must move matchmaking, presence, rate limits, game/session coordination and Socket.IO pub/sub to Redis.

Never expose Redis publicly. Use authentication, private networking, TLS, backups and monitoring.

## TURN
The included coturn service exposes UDP/TCP 3478 and enables TLS 5349 when production certificates are mounted.

Production checklist:
1. Give TURN a stable DNS name such as `turn.example.com` and a public IPv4 address.
2. Set `TURN_EXTERNAL_IP` to the public address (or the provider NAT mapping).
3. Place a trusted certificate and key at `infra/coturn-certs/fullchain.pem` and `infra/coturn-certs/privkey.pem`. Never commit them.
4. Open UDP/TCP 3478, TCP 5349, and UDP 49152-49252 in the TURN host firewall/security group.
5. Set strong `TURN_USERNAME` and `TURN_PASSWORD` secrets.
6. Configure `TURN_SERVERS` with UDP, TCP and TLS endpoints.

Example:
`[{"urls":["turn:turn.example.com:3478?transport=udp","turn:turn.example.com:3478?transport=tcp","turns:turn.example.com:5349"],"username":"TURN_USER","credential":"TURN_SECRET"}]`

Without certificate files, local coturn automatically disables TLS instead of failing startup. Never commit TURN credentials or certificates.

## App Check
Configure the Firebase web App Check provider/site key first, then enable REQUIRE_APP_CHECK=true.

## Production topology
Browser -> load balancer -> UmeTV realtime nodes -> Redis
Browser <-> WebRTC <-> TURN

Until Redis shared-state support is enabled, keep exactly one realtime application instance.
