# DePara - Sistema de Conversão e Mapeamento de Dados

## 📋 Descrição

DePara é uma aplicação Node.js que oferece funcionalidades de conversão e mapeamento de dados entre diferentes formatos e estruturas. O sistema foi projetado para ser facilmente instalável e executável, seguindo as melhores práticas de desenvolvimento e automação.

## 🚀 Funcionalidades

- **Conversão de Dados**: Transformação entre diferentes formatos (CSV, JSON, XML)
- **Mapeamento Inteligente**: Sistema de regras para mapeamento automático de campos
- **API REST**: Interface HTTP para integração com outros sistemas
- **Logs Estruturados**: Sistema de logging para monitoramento e debug
- **Configuração Flexível**: Suporte a variáveis de ambiente e arquivos de configuração

## 📋 Pré-requisitos

- **Node.js**: Versão 16.0.0 ou superior
- **npm**: Versão 8.0.0 ou superior
- **Git**: Para clonar o repositório

### Verificação das Versões

```bash
node --version
npm --version
git --version
```

## 🛠️ Instalação

### 1. Clonar o Repositório

```bash
git clone https://github.com/yopastorelli/DePara.git
cd DePara
```

### 2. Instalar Dependências

```bash
npm install
```

### 3. Configurar Variáveis de Ambiente

```bash
# Copiar arquivo de exemplo
copy env.example .env

# Editar o arquivo .env com suas configurações
notepad .env
```

### 4. Executar a Aplicação

```bash
# Modo desenvolvimento (com auto-reload)
npm run dev

# Modo produção
npm start
```

## 🎯 Como Usar

### Acesso à API

Após iniciar a aplicação, a API estará disponível em:
- **URL Base**: `http://localhost:3000`
- **Documentação**: `http://localhost:3000/api/docs`

### Endpoints Principais

- `GET /api/health` - Status da aplicação
- `POST /api/convert` - Conversão de dados
- `POST /api/map` - Mapeamento de campos
- `GET /api/status` - Informações do sistema

### Exemplo de Uso

```bash
# Verificar status da aplicação
curl http://localhost:3000/api/health

# Converter dados
curl -X POST http://localhost:3000/api/convert \
  -H "Content-Type: application/json" \
  -d '{"format": "csv", "data": "..."}'
```

## 🧪 Testes

```bash
# Executar todos os testes
npm test

# Executar testes em modo watch
npm run test:watch

# Executar testes com cobertura
npm run test:coverage
```

## 🔧 Desenvolvimento

### Scripts Disponíveis

- `npm start` - Inicia a aplicação em modo produção
- `npm run dev` - Inicia em modo desenvolvimento com nodemon
- `npm test` - Executa os testes
- `npm run lint` - Executa o linter ESLint
- `npm run setup` - Instala dependências

### Estrutura do Projeto

```
DePara/
├── src/           # Código fonte
├── tests/         # Testes automatizados
├── docs/          # Documentação adicional
├── logs/          # Arquivos de log
├── package.json   # Dependências e scripts
├── .gitignore     # Arquivos ignorados pelo Git
├── env.example    # Exemplo de variáveis de ambiente
└── README.md      # Este arquivo
```

## 📝 Logs

A aplicação gera logs estruturados para facilitar o debug e monitoramento:

- **Nível**: info, warn, error, debug
- **Localização**: `logs/app.log`
- **Formato**: JSON estruturado com timestamp

## 🤝 Como Contribuir

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está licenciado sob a Licença MIT - veja o arquivo [LICENSE](LICENSE) para detalhes.

## 🆘 Suporte

Se encontrar algum problema ou tiver dúvidas:

1. Verifique os logs da aplicação
2. Consulte a documentação da API
3. Abra uma issue no GitHub
4. Entre em contato com a equipe de desenvolvimento

## 🔄 Atualizações

Para manter o projeto atualizado:

```bash
git pull origin main
npm install
```

---

**DePara** - Transformando dados com simplicidade e eficiência! 🚀
