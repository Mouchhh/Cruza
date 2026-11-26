#!/usr/bin/env python3
"""Generate public settings in a separate, already staged deployment directory."""
import argparse
import json
import re
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
SMFC_URL = "https://uesbqljrcaugwcbzijcj.supabase.co"

def origin(value):
    if not isinstance(value, str):
        return False
    parsed = urlsplit(value)
    return bool(parsed.scheme == "https" and parsed.hostname and
                parsed.netloc == parsed.hostname and not (parsed.path or parsed.query or parsed.fragment))

def script(name, value):
    return f"window.{name}=Object.freeze({json.dumps(value, ensure_ascii=True)});\n"

def configure(profile, destination):
    slug, name = profile["slug"], profile["nom"]
    url, key = profile["supabase"]["url"], profile["supabase"]["cle_publiable"]
    site = profile["site"]["origine"]
    if not re.fullmatch(r"[a-z][a-z0-9-]{1,60}", slug or "") or not isinstance(name, str) or not name.strip():
        raise ValueError("Renseignez le nom et le slug du club.")
    if not origin(site) or not re.fullmatch(r"https://[a-z0-9]+\.supabase\.co", url or ""):
        raise ValueError("Renseignez l’origine HTTPS du club et l’URL Supabase.")
    if not re.fullmatch(r"sb_publishable_[A-Za-z0-9_-]+", key or ""):
        raise ValueError("Renseignez exclusivement une clé Supabase publiable sb_publishable_.")
    if (slug == "stade-mayennais") != (url == SMFC_URL) or (slug != "stade-mayennais" and site == "https://mouchhh.github.io"):
        raise ValueError("La cible du Stade Mayennais est réservée à son propre profil.")
    services = profile["services"]
    if any(value is not None and not origin(value) for value in services.values()):
        raise ValueError("Les services optionnels attendent une origine HTTPS.")
    if slug != "stade-mayennais" and "https://canva-educateur-smfc.onrender.com" in services.values():
        raise ValueError("Le serveur lié au Stade Mayennais ne peut pas être utilisé par le pilote.")
    for filename in ["index.html", "manager.html", "club-cloud-config.js", "canva-config.js", "ranking-config.js"]:
        path = destination / filename
        if path.is_symlink() or not path.is_file():
            raise ValueError(f"Copie de déploiement incomplète : {filename}.")
    (destination / "club-cloud-config.js").write_text(
        script("CRUZA_CLUB", {"slug": slug, "name": name}) +
        script("CLUB_CLOUD_CONFIG", {"url": url, "publishableKey": key}) +
        script("CRUZA_TERMS", {"url": "conditions-utilisation.html", "version": "v0.1-bêta"}))
    for file, name, field in [
        ("canva-config.js", "CLUB_CANVA_GATEWAY", "canva"),
        ("ranking-config.js", "CLUB_RANKING_GATEWAY", "classement"),
    ]:
        (destination / file).write_text(f"window.{name}={json.dumps(services.get(field) or '')};\n")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("profile", type=Path)
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()
    target = args.destination.resolve()
    if target == ROOT or ROOT in target.parents:
        parser.error("Utilisez une copie de déploiement hors du dépôt.")
    try:
        configure(json.loads(args.profile.read_text()), target)
    except (ValueError, TypeError, KeyError, OSError) as error:
        parser.exit(1, f"Configuration refusée : {error}\n")
    print("Configuration du club écrite dans la copie de déploiement.")
