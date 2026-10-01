@echo off
rem Abre o painel da documentacao com dois cliques.
rem
rem O painel nao e uma pagina estatica: ele precisa deste servidor para executar
rem build, screenshots e publicacao. Abrir painel\index.html direto no navegador
rem nao funciona.
chcp 65001 >nul
title Playsaurus - Documentacao de produtos
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js nao encontrado.
  echo   Instale a versao 20 ou mais nova em https://nodejs.org
  echo   e depois abra este arquivo de novo.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo.
  echo   Primeira vez aqui: instalando as dependencias.
  echo   Isso leva alguns minutos e so acontece uma vez.
  echo.
  rem "call" e obrigatorio: sem ele o .bat encerra no npm e nao chega no painel.
  call npm install
  if errorlevel 1 (
    echo.
    echo   A instalacao falhou. O motivo esta na mensagem acima.
    echo.
    pause
    exit /b 1
  )
)

echo.
echo   Subindo o painel. O navegador abre sozinho.
echo   Mantenha esta janela aberta: fecha-la desliga o painel.
echo.

call npm run painel
if errorlevel 1 (
  echo.
  echo   O painel encerrou com erro. O motivo esta na mensagem acima.
  echo.
  pause
)