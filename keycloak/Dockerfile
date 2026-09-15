# Keycloak with the Canton realm baked in. Realm import substitutes ${...} from the container's
# environment, so the file holds the shape and the env file holds the secrets. Import runs once:
# an existing realm is left alone on restart.
FROM quay.io/keycloak/keycloak:26.4
ENV KC_DB=postgres KC_HTTP_RELATIVE_PATH=/auth KC_HEALTH_ENABLED=true
COPY realm.json /opt/keycloak/data/import/canton.json
RUN /opt/keycloak/bin/kc.sh build
ENTRYPOINT ["/opt/keycloak/bin/kc.sh", "start", "--optimized", "--import-realm"]
