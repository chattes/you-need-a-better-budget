# Build the static app, then serve it with nginx as a non-root user.
# Runtime setting: GOOGLE_CLIENT_ID (see docs/self-hosting.md).

FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine AS runtime
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY docker/security-headers.conf /etc/nginx/ynbb-security-headers.conf
COPY docker/entrypoint.sh /usr/local/bin/ynbb-entrypoint.sh
COPY --from=build /app/dist /usr/share/nginx/html
RUN chmod 0755 /usr/local/bin/ynbb-entrypoint.sh \
 && rm -f /etc/nginx/conf.d/default.conf \
 && mkdir -p /tmp/nginx \
 && chown -R nginx:nginx /usr/share/nginx/html /tmp/nginx

USER nginx
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
ENTRYPOINT ["/usr/local/bin/ynbb-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
