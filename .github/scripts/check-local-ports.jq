# Vérifie que les ports publiés par compose.yaml restent réservés à l'ordinateur local.
# Entrée : `docker compose --profile '*' config --format json`.
#
# - Aucun port ne doit écouter sur toutes les interfaces (adresse absente ou 0.0.0.0) :
#   MiniJira n'a pas de comptes, tout appareil du réseau pourrait lire ou effacer les tickets.
# - Chaque port doit être publié sur 127.0.0.1 ET sur ::1 : sous Windows, `localhost`
#   essaie d'abord ::1, et un port absent y coûte environ 2 secondes par connexion.

[.services | to_entries[] | .key as $service | .value.ports[]?
  | {service: $service, host_ip, published}] as $ports
| ($ports | map(select(.host_ip != "127.0.0.1" and .host_ip != "::1"))) as $open
| ($ports | map(select(.host_ip == "127.0.0.1") | .published) | sort) as $ipv4
| ($ports | map(select(.host_ip == "::1") | .published) | sort) as $ipv6
| if ($open | length) > 0 then
    error("Ports ouverts à tout le réseau : \($open)")
  elif $ipv4 != $ipv6 then
    error("Chaque port doit être publié sur 127.0.0.1 et sur ::1 : \($ports)")
  else
    "OK : ports réservés à l'ordinateur local (\($ipv4 | join(", ")))"
  end
