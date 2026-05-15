from __future__ import annotations

import re
from typing import Any, Iterable


COUNTRY_ALIASES: dict[str, list[str]] = {
    "United States": ["united states", "united states of america", "usa", "u.s.a.", "u.s.", "us"],
    "India": ["india", "bharat"],
    "United Kingdom": ["united kingdom", "uk", "u.k.", "england", "scotland", "wales"],
    "Canada": ["canada"],
    "Australia": ["australia"],
    "Germany": ["germany", "deutschland"],
    "France": ["france"],
    "Singapore": ["singapore"],
    "United Arab Emirates": ["united arab emirates", "uae", "u.a.e.", "dubai", "abu dhabi"],
    "Netherlands": ["netherlands", "holland"],
    "Ireland": ["ireland"],
    "Switzerland": ["switzerland"],
    "Japan": ["japan"],
    "China": ["china"],
    "Hong Kong": ["hong kong"],
}

CITY_TO_COUNTRY: dict[str, str] = {
    "new york": "United States",
    "san francisco": "United States",
    "seattle": "United States",
    "austin": "United States",
    "boston": "United States",
    "chicago": "United States",
    "columbus": "United States",
    "dallas": "United States",
    "los angeles": "United States",
    "washington": "United States",
    "bengaluru": "India",
    "bangalore": "India",
    "mumbai": "India",
    "delhi": "India",
    "new delhi": "India",
    "gurgaon": "India",
    "gurugram": "India",
    "hyderabad": "India",
    "pune": "India",
    "chennai": "India",
    "kolkata": "India",
    "manipal": "India",
    "london": "United Kingdom",
    "toronto": "Canada",
    "vancouver": "Canada",
    "sydney": "Australia",
    "melbourne": "Australia",
    "berlin": "Germany",
    "paris": "France",
    "singapore": "Singapore",
    "dubai": "United Arab Emirates",
    "amsterdam": "Netherlands",
    "dublin": "Ireland",
    "zurich": "Switzerland",
    "tokyo": "Japan",
    "beijing": "China",
    "shanghai": "China",
}

TIMEZONE_ALIASES: dict[str, list[str]] = {
    "Eastern Time": ["eastern time", "et", "est", "edt"],
    "Central Time": ["central time", "ct", "cst", "cdt"],
    "Mountain Time": ["mountain time", "mt", "mst", "mdt"],
    "Pacific Time": ["pacific time", "pt", "pst", "pdt"],
    "UTC": ["utc", "gmt"],
    "India Standard Time": ["india standard time", "ist"],
    "Central European Time": ["central european time", "cet", "cest"],
}

US_STATE_ABBREVIATIONS = {
    "AL",
    "AK",
    "AZ",
    "AR",
    "CA",
    "CO",
    "CT",
    "DE",
    "FL",
    "GA",
    "HI",
    "IA",
    "ID",
    "IL",
    "IN",
    "KS",
    "KY",
    "LA",
    "MA",
    "MD",
    "ME",
    "MI",
    "MN",
    "MO",
    "MS",
    "NC",
    "ND",
    "NE",
    "NH",
    "NJ",
    "NM",
    "NV",
    "NY",
    "OH",
    "OK",
    "OR",
    "PA",
    "RI",
    "SC",
    "SD",
    "TN",
    "TX",
    "UT",
    "VA",
    "VT",
    "WA",
    "WI",
    "WV",
}


def build_location_intelligence(record: dict[str, Any], raw_text: str | None = None) -> dict[str, Any]:
    structured_locations = _structured_locations(record)
    search_text = "\n".join([raw_text or "", *structured_locations])
    countries = _countries_from_text(search_text)
    raw_mentions = _raw_location_mentions(search_text)
    mobility_signals = _mobility_signals(search_text)
    location_signals = _location_signals(record, raw_mentions)
    latest_location = current_job_location(record)
    resume_header_location = _clean(record.get("contact", {}).get("location"))

    return {
        "current_location": latest_location,
        "current_job_location": latest_location,
        "current_location_confidence": "latest_role" if latest_location else "not_stated",
        "resume_header_location": resume_header_location,
        "structured_locations": sorted(set(structured_locations), key=str.lower),
        "countries_associated": countries,
        "raw_location_mentions": raw_mentions,
        "mobility_signals": mobility_signals,
        "location_signals": location_signals,
        "timezone_signals": _timezone_signals(search_text),
        "work_authorization_signals": _snippet_signals(
            search_text,
            r"\b(work authorization|authorized to work|visa|h-?1b|green card|citizen|permanent resident|ead|opt|cpt)\b",
        ),
        "remote_work_signals": _snippet_signals(search_text, r"\b(remote|hybrid|onsite|on-site|in office|distributed team)\b"),
        "relocation_signals": _snippet_signals(search_text, r"\b(relocat(?:e|ion|ing)|open to move|willing to move)\b"),
    }


def enrich_record_locations(record: dict[str, Any], raw_text: str | None = None) -> dict[str, Any]:
    derived = record.setdefault("derived", {})
    intelligence = build_location_intelligence(record, raw_text)
    derived["location_intelligence"] = intelligence
    derived["countries_associated"] = intelligence["countries_associated"]
    facets = derived.setdefault("search_facets", {})
    facets["locations"] = intelligence["structured_locations"]
    facets["countries"] = [item["country"] for item in intelligence["countries_associated"]]
    return record


def countries_for_search(record: dict[str, Any]) -> list[str]:
    countries = []
    for item in record.get("derived", {}).get("countries_associated") or []:
        if isinstance(item, dict) and item.get("country"):
            countries.append(str(item["country"]))
        elif isinstance(item, str):
            countries.append(item)
    return sorted(set(countries), key=str.lower)


def _structured_locations(record: dict[str, Any]) -> list[str]:
    values: list[Any] = [
        record.get("contact", {}).get("location"),
        *[item.get("location") for item in record.get("experience") or [] if isinstance(item, dict)],
        *[item.get("location") for item in record.get("education") or [] if isinstance(item, dict)],
    ]
    for item in record.get("experience") or []:
        if not isinstance(item, dict):
            continue
        values.extend(
            stream.get("location")
            for stream in item.get("workstreams") or []
            if isinstance(stream, dict)
        )
    return [cleaned for value in values if (cleaned := _clean(value))]


def current_job_location(record: dict[str, Any]) -> str | None:
    """Only the latest role can establish current location.

    Contact/header locations are associated signals, but they are not reliable enough
    to label as current if the latest job does not state a location.
    """
    for item in record.get("experience") or []:
        if not isinstance(item, dict):
            continue
        return _clean(item.get("location"))
    return None


def _location_signals(record: dict[str, Any], raw_mentions: list[str]) -> list[dict[str, Any]]:
    signals: list[dict[str, Any]] = []
    contact_location = _clean(record.get("contact", {}).get("location"))
    if contact_location:
        signals.append(_location_signal(contact_location, "contact", "current/profile location"))

    for index, item in enumerate(record.get("experience") or []):
        if not isinstance(item, dict):
            continue
        location = _clean(item.get("location"))
        if location:
            context = "current_role" if index == 0 else "work_history"
            label = "current role location" if index == 0 else f"work history: {item.get('company') or 'unknown company'}"
            signals.append(_location_signal(location, context, label))
        for stream in item.get("workstreams") or []:
            if isinstance(stream, dict) and (stream_location := _clean(stream.get("location"))):
                signals.append(_location_signal(stream_location, "workstream", f"workstream: {stream.get('name') or item.get('company') or 'project'}"))

    for item in record.get("education") or []:
        if isinstance(item, dict) and (location := _clean(item.get("location"))):
            signals.append(_location_signal(location, "education", f"education: {item.get('school') or 'school'}"))

    for mention in raw_mentions[:12]:
        signals.append(_location_signal(mention, "raw_text", "raw CV text mention"))

    deduped: dict[tuple[str, str], dict[str, Any]] = {}
    for signal in signals:
        key = (str(signal.get("value", "")).lower(), str(signal.get("context", "")).lower())
        deduped.setdefault(key, signal)
    return list(deduped.values())[:40]


def _location_signal(value: str, context: str, evidence: str) -> dict[str, Any]:
    country = _country_for_location(value)
    return {
        "value": value,
        "context": context,
        "country": country,
        "evidence": evidence,
    }


def _country_for_location(value: str) -> str | None:
    lowered = value.lower()
    for country, aliases in COUNTRY_ALIASES.items():
        if any(_contains_phrase(lowered, alias) for alias in aliases):
            return country
    for city, country in CITY_TO_COUNTRY.items():
        if _contains_phrase(lowered, city):
            return country
    if _has_us_city_state_pattern(value):
        return "United States"
    return None


def _countries_from_text(text: str) -> list[dict[str, Any]]:
    lowered = text.lower()
    evidence_by_country: dict[str, set[str]] = {}

    for country, aliases in COUNTRY_ALIASES.items():
        for alias in aliases:
            if _contains_phrase(lowered, alias):
                evidence_by_country.setdefault(country, set()).add(alias)

    for city, country in CITY_TO_COUNTRY.items():
        if _contains_phrase(lowered, city):
            evidence_by_country.setdefault(country, set()).add(city)

    if _has_us_city_state_pattern(text):
        evidence_by_country.setdefault("United States", set()).add("US city/state pattern")

    countries = []
    for country, evidence in sorted(evidence_by_country.items()):
        countries.append(
            {
                "country": country,
                "relationship": "location",
                "evidence": sorted(evidence, key=str.lower)[:12],
            }
        )
    return countries


def _raw_location_mentions(text: str) -> list[str]:
    candidates = set()
    for match in re.finditer(r"\b[A-Z][A-Za-z .'-]{2,40},\s*[A-Z][A-Za-z .'-]{1,40}\b", text):
        value = _clean(match.group(0))
        if value and not _looks_like_sentence(value):
            candidates.add(value)
    for city in CITY_TO_COUNTRY:
        if _contains_phrase(text.lower(), city):
            candidates.add(city.title())
    return sorted(candidates, key=str.lower)[:40]


def _mobility_signals(text: str) -> list[str]:
    signals = []
    patterns = {
        "remote": r"\bremote\b",
        "hybrid": r"\bhybrid\b",
        "relocation": r"\brelocat(?:e|ion|ing)\b",
        "work authorization": r"\b(work authorization|authorized to work|visa|h-?1b|green card|citizen)\b",
        "timezone": r"\b(time zone|timezone|est|pst|cst|gmt|utc)\b",
    }
    for label, pattern in patterns.items():
        if re.search(pattern, text, re.IGNORECASE):
            signals.append(label)
    return signals


def _timezone_signals(text: str) -> list[dict[str, Any]]:
    lowered = text.lower()
    matches = []
    for label, aliases in TIMEZONE_ALIASES.items():
        evidence = [alias for alias in aliases if _contains_phrase(lowered, alias)]
        if evidence:
            matches.append({"timezone": label, "evidence": evidence[:5]})
    return matches


def _snippet_signals(text: str, pattern: str) -> list[str]:
    snippets = []
    for match in re.finditer(pattern, text, re.IGNORECASE):
        start = max(0, match.start() - 70)
        end = min(len(text), match.end() + 70)
        snippet = _clean(text[start:end])
        if snippet:
            snippets.append(snippet)
    deduped = []
    seen = set()
    for item in snippets:
        key = item.lower()
        if key not in seen:
            seen.add(key)
            deduped.append(item)
    return deduped[:8]


def _contains_phrase(text: str, phrase: str) -> bool:
    return re.search(rf"(?<![a-z0-9]){re.escape(phrase.lower())}(?![a-z0-9])", text) is not None


def _has_us_city_state_pattern(text: str) -> bool:
    state_pattern = "|".join(sorted(US_STATE_ABBREVIATIONS))
    return re.search(rf"\b[A-Z][A-Za-z .'-]{{2,40}},?\s+(?:{state_pattern})\b", text) is not None


def _clean(value: Any) -> str | None:
    if value is None:
        return None
    text = re.sub(r"\s+", " ", str(value)).strip(" ,;")
    return text or None


def _looks_like_sentence(value: str) -> bool:
    words = value.split()
    return len(words) > 7 or any(word.lower() in {"and", "with", "for", "using"} for word in words)
