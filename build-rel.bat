@echo off&cd /d %~dp0
mkdir build\uma-db-stuff
xcopy bin build\uma-db-stuff\bin /E /I /Q
copy uma-db-stuff.exe build\uma-db-stuff
cd build
7z a -tzip -mx=8 uma-db-stuff.zip uma-db-stuff
cd ..
rmdir /s /q build\uma-db-stuff
