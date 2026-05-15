from __future__ import annotations

from typing import Any

from .db import db


def tenant_workspace_analytics(tenant_id: str, *, limit: int = 15) -> dict[str, Any]:
    """Tenant-scoped, non-PII analytics from normalized candidate tables."""

    capped_limit = max(1, min(int(limit or 15), 50))
    with db() as conn:
        candidate_count = conn.execute(
            "select count(*) as count from candidates where tenant_id=%s",
            (tenant_id,),
        ).fetchone()
        top_skills = conn.execute(
            """
            select skill as label,
                   coalesce(category, 'Uncategorized') as category,
                   count(distinct document_id) as candidate_count
            from candidate_skills
            where tenant_id=%s
            group by skill, category
            order by candidate_count desc, lower(skill)
            limit %s
            """,
            (tenant_id, capped_limit),
        ).fetchall()
        top_domains = conn.execute(
            """
            select domain as label,
                   count(distinct document_id) as candidate_count,
                   round(avg(years)::numeric, 2) as average_years,
                   round(max(years)::numeric, 2) as max_years
            from candidate_domain_years
            where tenant_id=%s
            group by domain
            order by candidate_count desc, average_years desc, domain
            limit %s
            """,
            (tenant_id, capped_limit),
        ).fetchall()
        top_companies = conn.execute(
            """
            select company as label,
                   count(distinct document_id) as candidate_count
            from candidate_experience
            where tenant_id=%s and nullif(trim(company), '') is not null
            group by company
            order by candidate_count desc, lower(company)
            limit %s
            """,
            (tenant_id, capped_limit),
        ).fetchall()
        top_locations = conn.execute(
            """
            select location as label,
                   country,
                   signal_type,
                   count(distinct document_id) as candidate_count
            from candidate_locations
            where tenant_id=%s and nullif(trim(location), '') is not null
            group by location, country, signal_type
            order by candidate_count desc, lower(location)
            limit %s
            """,
            (tenant_id, capped_limit),
        ).fetchall()
        top_countries = conn.execute(
            """
            select country as label,
                   count(distinct document_id) as candidate_count
            from candidate_locations
            where tenant_id=%s and nullif(trim(country), '') is not null
            group by country
            order by candidate_count desc, lower(country)
            limit %s
            """,
            (tenant_id, capped_limit),
        ).fetchall()
        education = conn.execute(
            """
            select school as label,
                   count(distinct document_id) as candidate_count
            from candidate_education
            where tenant_id=%s and nullif(trim(school), '') is not null
            group by school
            order by candidate_count desc, lower(school)
            limit %s
            """,
            (tenant_id, capped_limit),
        ).fetchall()
        candidate_rows = conn.execute(
            "select record_json from candidates where tenant_id=%s",
            (tenant_id,),
        ).fetchall()

    return {
        "candidate_count": int(_row_value(candidate_count, "count", 0) or 0),
        "top_skills": [_analytics_row(row, extra=("category",)) for row in top_skills],
        "top_domains": [_analytics_row(row, extra=("average_years", "max_years")) for row in top_domains],
        "top_companies": [_analytics_row(row) for row in top_companies],
        "top_locations": [_analytics_row(row, extra=("country", "signal_type")) for row in top_locations],
        "top_countries": [_analytics_row(row) for row in top_countries],
        "top_schools": [_analytics_row(row) for row in education],
        "experience_distribution": _experience_distribution([_row_value(row, "record_json", {}) for row in candidate_rows]),
    }


def _analytics_row(row: Any, extra: tuple[str, ...] = ()) -> dict[str, Any]:
    item = {
        "label": _row_value(row, "label", ""),
        "candidate_count": int(_row_value(row, "candidate_count", 0) or 0),
    }
    for key in extra:
        value = _row_value(row, key, None)
        if hasattr(value, "__float__"):
            value = float(value)
        item[key] = value
    return item


def _experience_distribution(records: list[Any]) -> list[dict[str, Any]]:
    buckets = {
        "0-2 years": 0,
        "3-5 years": 0,
        "6-9 years": 0,
        "10+ years": 0,
        "Unknown": 0,
    }
    for record in records:
        years = _record_total_years(record)
        if years is None:
            buckets["Unknown"] += 1
        elif years < 3:
            buckets["0-2 years"] += 1
        elif years < 6:
            buckets["3-5 years"] += 1
        elif years < 10:
            buckets["6-9 years"] += 1
        else:
            buckets["10+ years"] += 1
    return [{"label": label, "candidate_count": count} for label, count in buckets.items()]


def _record_total_years(record: Any) -> float | None:
    if not isinstance(record, dict):
        return None
    value = (((record.get("derived") or {}).get("hr_profile") or {}).get("total_years_experience"))
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _row_value(row: Any, key: str, default: Any = None) -> Any:
    if row is None:
        return default
    if isinstance(row, dict):
        return row.get(key, default)
    try:
        return row[key]
    except (KeyError, TypeError, IndexError):
        return getattr(row, key, default)
