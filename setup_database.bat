@echo off
echo Creating ecommerce_mvp database...

REM Create the database
"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -c "DROP DATABASE IF EXISTS ecommerce_mvp;"
"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -c "CREATE DATABASE ecommerce_mvp;"

REM Run the schema script
"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d ecommerce_mvp -f database.sql

echo Database setup complete!
pause
