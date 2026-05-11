@echo off

:loop
timeout /t 5 >nul

git diff --quiet
IF ERRORLEVEL 1 (
    git add .
    git commit -m "auto update"
    git push
)

goto loop