@echo off
rem Builds the "website" folder for willdidthis.com: just the game page and the truck model.
rem After changing the game, double-click this, then upload what's in the "website" folder to your GitHub repo
rem (Add file, then Upload files; drag the trees folder in too). Netlify also works: drag the folder onto its Deploys page.
cd /d "%~dp0"
if exist website rmdir /s /q website
mkdir website
copy /y index.html website\ >nul
copy /y car.glb website\ >nul
rem online accounts + multiplayer settings (Firebase web config; null until it's set up)
copy /y firebase-config.js website\ >nul
rem real tree pictures for the forests (baked once by tools\bake-trees.html) - copied at 640 px tall to download faster
rem (if that step can't run, the full-size pictures are copied instead)
mkdir website\trees
powershell -NoProfile -ExecutionPolicy Bypass -File tools\shrink-trees.ps1 trees website\trees || copy /y trees\*.png website\trees\ >nul
rem the recorded engine sound (sounds folder)
mkdir website\sounds
copy /y sounds\*.mp3 website\sounds\ >nul
rem Netlify settings file: serve the 3D model with the right type and let browsers cache it for an hour
(
echo /car.glb
echo   Content-Type: model/gltf-binary
echo   Cache-Control: public, max-age=3600
) > website\_headers
rem GitHub Pages: tells GitHub which custom domain this site answers on
echo willdidthis.com> website\CNAME
echo.
echo Website folder ready: %~dp0website
echo Upload the files in it to your GitHub repo to publish.
echo.
pause
