# Central de ajuda — Passo 2: ligar a documentação do Playsaurus

Use este prompt **depois que a estrutura da Central de ajuda já estiver criada**.

Este passo conecta somente a documentação gerada pelo Playsaurus à Home da Central e à página de Documentação.

**Não altere, alimente ou integre a página de Tutoriais.** Tutoriais pertencem a outro processo.

## Prompt

```text
Analise primeiro a Central de ajuda já implementada neste projeto.

A estrutura visual, as rotas e a página de Tutoriais já existem.

Agora quero ligar SOMENTE a documentação publicada pelo Playsaurus à Central de ajuda.

A fonte oficial é:

`/docs/help-index.json`

IMPORTANTE:
- NÃO implemente tutoriais.
- NÃO use a documentação como fonte de tutoriais.
- NÃO altere `/ajuda/tutoriais`, exceto se for absolutamente necessário para corrigir um problema técnico causado por código compartilhado.
- A busca da página de Tutoriais continua sem fonte real neste passo.
- Não use nenhum projeto externo como referência de conteúdo, nomes, rotas ou comportamento.
- Tudo deve ser derivado do projeto atual e do `help-index.json` atual.

Este passo deve alimentar somente:

1. a busca da Home;
2. as Perguntas frequentes da Home;
3. a busca da página Documentação;
4. as categorias Referência e Usabilidade;
5. a lista de artigos da página Documentação.

Não replique artigos no código da aplicação.
Não leia os arquivos Markdown diretamente.
Não altere o portal `/docs/`.

==================================================
1. CARREGAR O ÍNDICE DO PLAYSAURUS
==================================================

Consumir:

`/docs/help-index.json`

Crie um único serviço/adaptador de dados para a Central.

Não faça `fetch` duplicado em cada tela se o projeto já possui mecanismo compartilhado de queries/cache.

Se o projeto já usa React Query/TanStack Query, SWR ou equivalente, reaproveite-o.

### Locale

A Central deve trabalhar em Português (Brasil).

Tentar nesta ordem:

1. `pt-BR` em `porLocale`;
2. `defaultLocale` informado pelo próprio índice;
3. formato plano `paginas` + `faqs`, se o documento usar esse contrato.

Não invente traduções quando o locale não existir.

### Estrutura esperada

Página:

- `id`
- `titulo`
- `secao`
- `secaoId`
- `url`
- `publico`
- `headings`
- `resumo`
- `texto`

FAQ:

- `pergunta`
- `resposta`
- `categoria`
- `publico`
- `ancora`
- `url`

Se o formato real do `help-index.json` tiver pequenas diferenças, adapte o serviço ao contrato real encontrado em vez de inventar campos.

O carregamento deve possuir estados simples de:

- carregando;
- erro com opção de tentar novamente;
- vazio.

==================================================
2. FILTRAR O PÚBLICO
==================================================

Respeitar o campo `publico` do índice.

- `todos`: pode ser exibido a qualquer usuário autenticado com acesso à Central.
- `admin`: exibir somente quando o sistema conseguir confirmar o papel administrativo equivalente.

Se o projeto não possuir um conceito compatível de administrador, mostrar somente `todos`.

Não adivinhe permissões.

==================================================
3. BUSCA DA HOME E DA DOCUMENTAÇÃO
==================================================

Ligar os dados da documentação à barra de pesquisa já criada em:

- `/ajuda`;
- `/ajuda/documentacao`.

NÃO ligar esses dados à busca de `/ajuda/tutoriais`.

Neste passo, a pesquisa retorna somente:

- artigos;
- perguntas frequentes.

Tutoriais serão adicionados futuramente por outro processo.

### Campos pesquisáveis

Artigos:

- título;
- headings;
- resumo;
- seção;
- texto.

FAQs:

- pergunta;
- categoria;
- resposta.

### Normalização

A pesquisa deve:

- ignorar maiúsculas/minúsculas;
- ignorar acentos;
- normalizar espaços;
- dividir a consulta em termos;
- exigir que todos os termos estejam presentes no conjunto de campos pesquisáveis.

### Peso sugerido

Artigo:

- título: 12;
- headings: 7;
- resumo: 4;
- seção: 3;
- texto: 1.

FAQ:

- pergunta: 12;
- categoria: 5;
- resposta: 2.

Ordenar pelo score decrescente.

Se o projeto já possuir um mecanismo de busca equivalente e consistente, pode reutilizá-lo desde que mantenha esse comportamento funcional.

### Abrir resultados

Resultado de artigo:

abrir `page.url` em nova aba.

Resultado de FAQ:

abrir a URL/âncora fornecida pelo próprio índice em nova aba.

Usar:

`target="_blank"`
`rel="noopener noreferrer"`

Nunca abrir uma cópia interna do artigo dentro da Central.

==================================================
4. HOME — PREENCHER PERGUNTAS FREQUENTES
==================================================

Na rota `/ajuda`, manter exatamente a estrutura visual já criada.

Popular a seção:

`Perguntas frequentes`

usando exclusivamente `faqs` do `help-index.json`.

Descrição:

`Respostas rápidas publicadas na documentação oficial do <Nome do Projeto>.`

### Categorias

Gerar automaticamente a partir de `faq.categoria`.

Exibir como filtros horizontais/pílulas.

A categoria ativa deve possuir contraste maior.

Ao trocar de categoria:

- fechar a pergunta aberta;
- voltar para o limite inicial;
- mostrar somente FAQs daquela categoria.

### Accordion

Cada FAQ deve mostrar:

- pergunta;
- indicador/seta à direita;
- resposta quando aberta.

Usar `aria-expanded`.

Apenas uma FAQ precisa ficar aberta por vez.

### Limite

Mostrar inicialmente até 6 perguntas da categoria.

Se houver mais:

`Ver todas as X perguntas`

Depois de expandir:

`Mostrar menos perguntas`

Se não existirem FAQs publicadas, usar estado vazio discreto.

Não criar perguntas de demonstração.

==================================================
5. DOCUMENTAÇÃO — CATEGORIAS
==================================================

Na rota `/ajuda/documentacao`, alimentar somente as duas categorias já existentes:

- `Referência` → `secaoId === "referencia"`
- `Usabilidade` → `secaoId === "usabilidade"`

Não mostrar Arquitetura, mesmo que ela exista no índice.

### Card da categoria

Derivar do índice:

- nome da seção;
- quantidade real de páginas/artigos;
- resumo curto da página inicial da seção quando disponível.

Não dependa da extensão física do arquivo para encontrar a página inicial.
Prefira o contrato do índice, `secaoId`, URL e rota.

Se o índice expuser uma página cuja URL representa a própria seção, use-a como página inicial.

Os dois cards ficam:

- lado a lado no desktop;
- empilhados no mobile.

Ao clicar, selecionar a categoria NA MESMA página e carregar a lista abaixo.

Ao mudar de categoria, voltar ao limite inicial de artigos.

==================================================
6. DOCUMENTAÇÃO — LISTA DE ARTIGOS
==================================================

Abaixo dos cards, preencher a lista da categoria selecionada.

Título da seção:

nome da categoria selecionada.

Descrição:

`Abra um artigo para consultar a versão publicada da documentação.`

Cada linha deve exibir:

- ícone simples de documento;
- título;
- resumo curto quando existir;
- seta/indicador à direita.

Ao clicar, abrir `page.url` diretamente em nova aba:

`target="_blank"`
`rel="noopener noreferrer"`

Não criar rota intermediária para o artigo.
Não renderizar o artigo dentro da Central.

### Limite

Mostrar inicialmente até 10 artigos.

Se houver mais:

`Ver todos os X artigos`

Depois:

`Mostrar menos artigos`

==================================================
7. BOTÃO DOCUMENTAÇÃO COMPLETA
==================================================

Manter o botão existente logo abaixo da busca da página Documentação:

`Abrir documentação completa`

Destino:

`/docs/`

Abrir em nova aba:

`target="_blank"`
`rel="noopener noreferrer"`

Não trocar esse botão por uma navegação interna da Central.

==================================================
8. TUTORIAIS — NÃO TOCAR
==================================================

Este requisito é obrigatório.

A rota `/ajuda/tutoriais` deve continuar somente com a estrutura criada no Passo 1:

- barra superior;
- Voltar;
- bloco principal;
- barra de pesquisa visual;
- `Os seus percursos` vazio;
- `Explorar por tema` vazio.

NÃO:

- importar `help-index.json` nessa rota;
- mostrar artigos nessa rota;
- mostrar FAQs nessa rota;
- transformar artigos em tutoriais;
- criar cards de tutorial;
- criar módulos;
- criar progresso;
- implementar tours;
- reutilizar a lista de Documentação dentro de Tutoriais.

A implementação real de tutoriais virá em outro processo.

==================================================
9. ESTADOS DE LOADING, ERRO E VAZIO
==================================================

A integração da documentação deve tratar:

### Loading

Usar skeleton/estado discreto coerente com o design existente.

### Erro

Mostrar mensagem simples e ação:

`Tentar novamente`

Na página Documentação, o botão `Abrir documentação completa` deve continuar disponível mesmo quando o índice falhar, desde que `/docs/` exista.

### Vazio

Não inventar conteúdo.

Exemplos de estado vazio aceitáveis:

- nenhuma FAQ publicada;
- nenhuma página disponível para a categoria selecionada.

==================================================
10. ACESSIBILIDADE
==================================================

Garantir:

- navegação por teclado;
- foco visível;
- busca com rótulo acessível;
- accordions com `aria-expanded`;
- filtros de FAQ com semântica de seleção adequada;
- cards de categoria com estado selecionado acessível;
- links externos com `rel="noopener noreferrer"`.

==================================================
11. O QUE NÃO FAZER
==================================================

- Não alterar `/docs/`.
- Não duplicar o gerador de `help-index.json`.
- Não ler Markdown diretamente.
- Não hardcodar artigos.
- Não hardcodar FAQs.
- Não mostrar Arquitetura.
- Não criar página interna de artigo.
- Não copiar o corpo dos artigos para TS/TSX/JS.
- Não integrar documentação à página Tutoriais.
- Não criar tutoriais neste passo.
- Não criar um segundo serviço de busca por tela.
- Não hardcodar o nome de outro projeto.
- Não copiar textos, categorias, rotas ou branding de outra aplicação.

==================================================
12. CRITÉRIOS DE ACEITAÇÃO
==================================================

Considere a integração concluída somente se:

1. `/ajuda`:
   - mantém o mesmo layout do Passo 1;
   - a busca encontra artigos e FAQs reais;
   - Perguntas frequentes vêm do `help-index.json`;
   - categorias de FAQ são derivadas dos dados;
   - limite inicial é 6.

2. `/ajuda/documentacao`:
   - a busca consulta artigos e FAQs reais;
   - o botão “Abrir documentação completa” continua abaixo da busca;
   - mostra somente Referência e Usabilidade;
   - mostra contagem real de artigos;
   - mostra resumo real das categorias quando disponível;
   - lista artigos da categoria selecionada;
   - limite inicial é 10;
   - cada artigo abre a URL publicada em nova aba.

3. `/ajuda/tutoriais`:
   - permanece visualmente como estava;
   - não recebe dados do `help-index.json`;
   - continua sem tutoriais inventados.

4. O serviço usa `/docs/help-index.json` como única fonte da documentação da Central.

5. Conteúdos respeitam o campo `publico` quando houver contexto real de permissão.

6. Toda a interface continua em Português (Brasil).

7. Atualizar a documentação no Playsaurus passa a atualizar automaticamente busca, FAQs e listas de artigos sem alteração manual no código da aplicação.

8. Não existe nenhuma referência hardcoded a outro projeto, produto ou aplicação.

Ao terminar, liste somente:
- arquivos criados;
- arquivos alterados;
- serviço/adaptador criado para `help-index.json`;
- onde a busca foi conectada;
- onde FAQ/artigos foram conectados;
- confirmação explícita de que Tutoriais não foi integrado;
- qualquer limitação real encontrada.
```
