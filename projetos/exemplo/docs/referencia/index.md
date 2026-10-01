# Referência do Playsaurus

Consulta rápida dos comandos, arquivos e convenções usados pela ferramenta.

## Comandos principais

| Comando | Função |
|---|---|
| `npm run painel` | Abre o painel local |
| `npm run build -- <id>` | Gera os pacotes interno e cliente |
| `npm run start -- <id>` | Gera e serve a documentação interna |
| `npm run serve -- <id>` | Serve um build já existente |
| `npm run screenshots -- <id>` | Captura screenshots do produto |
| `npm run pdf -- <id>` | Gera PDFs cliente/equipe |
| `npm run publish -- <id>` | Copia o pacote cliente para o repositório do produto |
| `npm run i18n:init -- <id>` | Cria scaffolds de tradução |
| `npm run i18n:check -- <id>` | Verifica traduções pendentes |
| `npm run auditoria -- <id>` | Executa a auditoria opcional |
| `npm run videos -- <id>` | Executa a gravação opcional de tutorial |

## Arquivos do projeto

| Arquivo/pasta | Uso |
|---|---|
| `projeto.json` | Nome, URLs, seções, idiomas e publicação |
| `tema.css` | Tokens visuais do portal |
| `docs/` | Markdown no idioma padrão |
| `i18n/<locale>/` | Traduções |
| `static/` | Imagens e outros assets fonte |
| `playwright/` | Login e specs de screenshots |
| `.env` | Credenciais locais; não versionar |
| `output/interno/` | Portal completo |
| `output/cliente/` | Portal pronto para publicação |
| `.playsaurus/` | Cache e temporários descartáveis |

## Arquivos gerados

Um pacote cliente pode conter:

```text
index.html
help-index.json
sitemap.xml
pdf/
```

### `index.html`

Portal standalone com conteúdo, navegação, busca, tema, idiomas e assets incorporados.

### `help-index.json`

Índice estruturado das páginas e FAQs. Pode ser consumido por uma Central de Ajuda ou outra integração do produto.

### `sitemap.xml`

Gerado somente para o pacote cliente quando existe URL pública. Usa as URLs canônicas do portal, por exemplo:

```text
https://produto.exemplo/docs
https://produto.exemplo/docs/usabilidade
https://produto.exemplo/docs/usabilidade/login
```

O sitemap não publica caminhos físicos como `index.html`.

## Convenções de documentação

### Página inicial da seção

```text
docs/usabilidade/index.md
```

vira:

```text
/docs/usabilidade
```

### Ordem das páginas

Use prefixos numéricos:

```text
01-primeiros-passos.md
02-login.md
10-configuracoes.md
```

O número define a ordem, mas não entra na URL.

### Recursos Markdown suportados

- headings e âncoras;
- links relativos;
- imagens;
- tabelas;
- blocos de código;
- Mermaid;
- admonitions `:::info`, `:::warning`, `:::danger` e equivalentes.

## Seções padrão

| Seção | Objetivo |
|---|---|
| Arquitetura | Informação técnica e interna |
| Usabilidade | Guias orientados às tarefas do usuário |
| Referência | Consulta rápida, regras, glossário e FAQ |

A visibilidade do cliente é controlada por seção no `projeto.json`/painel.

## Status comuns do painel

- **Configurado aqui** — o caminho local do repositório foi salvo nesta máquina;
- **Não configurado** — é necessário salvar o caminho antes das ações dependentes dele;
- **Local** — a URL pública ainda aponta para localhost;
- **Só interna** — a seção não entra no pacote cliente;
- **Incluída** — a seção entra no pacote cliente.
