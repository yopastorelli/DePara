# Configuracao

## Screensaver
Persistencia canonicamente em `data/depara-config.json` no bloco `screensaverConfig`.
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
Persistencia canonicamente em `data/depara-config.json`:
- `slideshowConfig`
- `slideshowSelectedPath`

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
- `data/update-config.json`
- `data/update-state.json`
- `data/update-history.log`
- `data/update.lock`

## PM2
Variaveis uteis:
- `NODE_ENV=production`
- `PM2_APP_NAME=DePara` (quando aplicavel)
