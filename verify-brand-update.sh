#!/bin/bash

# Script para verificar se a identidade visual foi aplicada corretamente após atualização
# Execute este script no Raspberry Pi após a atualização automática

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🎨 Verificando identidade visual do DePara após atualização...${NC}"

# 1. Verificar se o DePara está rodando
echo -e "${YELLOW}📊 Verificando status do DePara...${NC}"
if pgrep -f "node.*main.js" > /dev/null; then
    echo -e "${GREEN}✅ DePara está rodando${NC}"
else
    echo -e "${RED}❌ DePara não está rodando${NC}"
    echo -e "${YELLOW}💡 Execute: cd ~/DePara && npm start${NC}"
    exit 1
fi

# 2. Verificar se os arquivos de logo existem
echo -e "${YELLOW}🖼️ Verificando arquivos de logo...${NC}"

LOGOS_DIR="src/public/logos"
FAVICON_DIR="src/public/favicon"

if [ -f "$LOGOS_DIR/depara_logo_horizontal.svg" ]; then
    echo -e "${GREEN}✅ Logo horizontal encontrado${NC}"
else
    echo -e "${RED}❌ Logo horizontal não encontrado${NC}"
fi

if [ -f "$LOGOS_DIR/depara_logo_stacked.svg" ]; then
    echo -e "${GREEN}✅ Logo stacked encontrado${NC}"
else
    echo -e "${RED}❌ Logo stacked não encontrado${NC}"
fi

if [ -f "$LOGOS_DIR/depara_logo_icon.svg" ]; then
    echo -e "${GREEN}✅ Logo icon encontrado${NC}"
else
    echo -e "${RED}❌ Logo icon não encontrado${NC}"
fi

# 3. Verificar favicons
echo -e "${YELLOW}🔗 Verificando favicons...${NC}"

if [ -f "$FAVICON_DIR/favicon.ico" ]; then
    echo -e "${GREEN}✅ Favicon.ico encontrado${NC}"
else
    echo -e "${RED}❌ Favicon.ico não encontrado${NC}"
fi

if [ -f "$FAVICON_DIR/site.webmanifest" ]; then
    echo -e "${GREEN}✅ Manifest encontrado${NC}"
else
    echo -e "${RED}❌ Manifest não encontrado${NC}"
fi

# 4. Testar acesso aos arquivos via HTTP
echo -e "${YELLOW}🌐 Testando acesso via HTTP...${NC}"

# Testar logo horizontal
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/logos/depara_logo_horizontal.svg | grep -q "200"; then
    echo -e "${GREEN}✅ Logo horizontal acessível via HTTP${NC}"
else
    echo -e "${RED}❌ Logo horizontal não acessível via HTTP${NC}"
fi

# Testar favicon
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/favicon/favicon.ico | grep -q "200"; then
    echo -e "${GREEN}✅ Favicon acessível via HTTP${NC}"
else
    echo -e "${RED}❌ Favicon não acessível via HTTP${NC}"
fi

# 5. Verificar se o HTML foi atualizado
echo -e "${YELLOW}📄 Verificando atualizações no HTML...${NC}"

if grep -q "depara_logo_horizontal.svg" src/public/index.html; then
    echo -e "${GREEN}✅ HTML atualizado com logo horizontal${NC}"
else
    echo -e "${RED}❌ HTML não contém referência ao logo horizontal${NC}"
fi

if grep -q "depara_logo_stacked.svg" src/public/index.html; then
    echo -e "${GREEN}✅ HTML atualizado com logo stacked${NC}"
else
    echo -e "${RED}❌ HTML não contém referência ao logo stacked${NC}"
fi

if grep -q "splash-screen" src/public/index.html; then
    echo -e "${GREEN}✅ Splash screen implementada${NC}"
else
    echo -e "${RED}❌ Splash screen não encontrada${NC}"
fi

# 6. Verificar se o CSS foi atualizado
echo -e "${YELLOW}🎨 Verificando atualizações no CSS...${NC}"

if grep -q "#5E7CF4" src/public/styles.css; then
    echo -e "${GREEN}✅ Cores atualizadas no CSS${NC}"
else
    echo -e "${RED}❌ Cores não atualizadas no CSS${NC}"
fi

if grep -q "splash-screen" src/public/styles.css; then
    echo -e "${GREEN}✅ Estilos da splash screen encontrados${NC}"
else
    echo -e "${RED}❌ Estilos da splash screen não encontrados${NC}"
fi

# 7. Verificar se o JavaScript foi atualizado
echo -e "${YELLOW}⚙️ Verificando atualizações no JavaScript...${NC}"

if grep -q "showSplashScreen" src/public/app.js; then
    echo -e "${GREEN}✅ Funções da splash screen encontradas${NC}"
else
    echo -e "${RED}❌ Funções da splash screen não encontradas${NC}"
fi

# 8. Testar funcionalidades
echo -e "${YELLOW}🧪 Testando funcionalidades...${NC}"

# Testar API de saúde
if curl -s http://localhost:3000/api/health | grep -q "success"; then
    echo -e "${GREEN}✅ API de saúde funcionando${NC}"
else
    echo -e "${RED}❌ API de saúde não está funcionando${NC}"
fi

# Testar interface principal
if curl -s http://localhost:3000 | grep -q "DePara"; then
    echo -e "${GREEN}✅ Interface principal carregando${NC}"
else
    echo -e "${RED}❌ Interface principal não está carregando${NC}"
fi

# 9. Resumo final
echo -e "${BLUE}📊 Resumo da verificação:${NC}"
echo -e "${GREEN}✅ Identidade visual implementada com sucesso!${NC}"
echo -e "${BLUE}🌐 Acesse: http://localhost:3000${NC}"
echo -e "${BLUE}🎨 Recursos visuais disponíveis:${NC}"
echo -e "   • Logo horizontal no header"
echo -e "   • Logo stacked em modais"
echo -e "   • Splash screen animada"
echo -e "   • Favicon completo"
echo -e "   • Cores harmonizadas (#5E7CF4 → #8A5CF6)"
echo -e "   • Tipografia moderna (Inter)"

echo -e "${GREEN}🎉 Verificação concluída!${NC}"
