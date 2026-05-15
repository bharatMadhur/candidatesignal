from resume_intel.db import applied_migrations, migrate


if __name__ == "__main__":
    migrate()
    print("database migrated")
    for item in applied_migrations():
        print(f"{item['version']} {item['description']} {item['applied_at']}")
