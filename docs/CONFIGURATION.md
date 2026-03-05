# Configuracao

## Screensaver
Persistencia em `localStorage.screensaverConfig`:
```json
{
  "enabled": true,
  "idleMinutes": 3,
  "exitMode": "esc_only"
}
```

Comportamento:
- `enabled=false`: nao entra em screensaver.
- `idleMinutes`: timeout de inatividade.
- saida: somente `ESC`.
- app minimizada: abre janela dedicada fullscreen.

## Slideshow
Persistencia em `localStorage.slideshowConfig` e `localStorage.slideshowSelectedPath`.

Atalhos vigentes no viewer:
- `ArrowLeft` / `ArrowRight`
- `Space`
- `d` apagar
- `o` ocultar
- `a` ajustar
- `f` favoritar
- `ESC` sair do screensaver (se ativo) ou fechar viewer

## Auto-update
Config principal via `PUT /api/update/auto/config`:
- `enabled`
- `autoApply`
- `checkIntervalMinutes`
- `healthTimeoutMs`
- `healthRetries`
- `healthPath`
- `maxConsecutiveFailures`

Arquivos de estado:
- `src/data/update-config.json`
- `src/data/update-state.json`
- `src/data/update-history.log`

## PM2
Variaveis uteis:
- `NODE_ENV=production`
- `PM2_APP_NAME=DePara` (quando aplicavel)
