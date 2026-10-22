# Central de ajuda — Passo 1: criar a estrutura

Use este prompt primeiro. Ele cria a Central de ajuda, as rotas e o padrão visual, **sem ligar a documentação gerada pelo Playsaurus ainda**.

A página de Tutoriais também é criada neste passo, mas permanece vazia. Tutoriais pertencem a outro processo e não devem receber dados da documentação.

## Prompt

```text
Analise o projeto atual antes de alterar qualquer arquivo.

Quero criar uma Central de ajuda integrada ao projeto, usando o design system, roteador, componentes, tipografia, ícones e padrões já existentes na aplicação.

Neste primeiro passo, crie APENAS a estrutura, as rotas, os componentes e o visual da Central.

NÃO conecte ainda `/docs/help-index.json`.
NÃO leia artigos da documentação.
NÃO crie FAQs fictícias.
NÃO crie tutoriais fictícios.
NÃO implemente o mecanismo real de tutoriais.

A ligação com a documentação será feita em um segundo passo separado.

==================================================
1. REGRAS GERAIS
==================================================

- Toda a interface deve estar em Português (Brasil).
- Identifique o nome real do projeto e use-o nos textos quando necessário.
- Não deixe referências a nenhum projeto, produto ou sistema externo de exemplo.
- Reaproveite o design system e a arquitetura já existentes na aplicação.
- Não introduza um segundo design system.
- Preserve autenticação, permissões, shell e navegação existentes.
- Mantenha textos simples, curtos e objetivos.
- Use superfícies claras/neutras, bordas finas, cantos arredondados discretos e bastante espaço em branco.
- Evite gradientes decorativos, ilustrações desnecessárias e efeitos chamativos.
- A Central deve parecer parte nativa da aplicação.

A Central precisa ficar preparada para receber dados externos depois, mas neste passo não deve depender da documentação publicada.

==================================================
2. ROTAS
==================================================

Criar, usando o roteador já existente no projeto:

- `/ajuda`
  Página inicial da Central de ajuda.

- `/ajuda/tutoriais`
  Página de Tutoriais e visitas guiadas.

- `/ajuda/documentacao`
  Página de Documentação.

Se já existirem rotas equivalentes, reaproveite-as em vez de criar duplicatas.

As três páginas devem permanecer dentro do shell/layout autenticado já usado pela aplicação.

Nas páginas `/ajuda/tutoriais` e `/ajuda/documentacao`, incluir botão **Voltar** para `/ajuda`.

==================================================
3. COMPONENTES REUTILIZÁVEIS
==================================================

Evite repetir a mesma estrutura nas três telas.

Crie componentes reutilizáveis, conforme fizer sentido para a stack atual, para pelo menos:

- bloco principal/hero da Central;
- barra de pesquisa da Central;
- card de entrada;
- cabeçalho de seção;
- estado vazio discreto;
- estrutura de lista/accordion de FAQ;
- estrutura de linha de artigo.

A barra de pesquisa criada agora deve estar preparada para receber uma fonte de resultados depois, mas neste primeiro passo NÃO deve consultar documentação nem tutoriais.

Não invente resultados apenas para demonstrar o componente.

==================================================
4. HOME — `/ajuda`
==================================================

### Barra superior

Título:

`Central de ajuda`

Subtítulo:

`Tutoriais guiados e documentação do <Nome do Projeto>`

Não exiba a busca global normal da aplicação nessa barra se ela competir visualmente com a busca da Central.

### Bloco principal

Criar um bloco grande, com fundo claro/neutro e conteúdo centralizado.

Usar um ícone simples relacionado a ajuda ou descoberta.

Título:

`Como podemos ajudar?`

Descrição:

`Aprenda a utilizar o <Nome do Projeto> através de visitas guiadas ou consulte a documentação publicada.`

Abaixo da descrição, mostrar uma barra de pesquisa larga e centralizada.

Placeholder:

`Pesquisar tutoriais, artigos e perguntas frequentes...`

Neste primeiro passo, a barra é apenas a estrutura visual e de interação. Não conectar nenhuma fonte de dados.

### Dois cards

Logo abaixo da busca, criar exatamente dois cards.

No desktop: lado a lado.
No mobile: empilhados.

#### Card 1 — Tutoriais

Título:

`Tutoriais e visitas guiadas`

Descrição:

`Percursos interativos adaptados às suas funções para aprender a utilizar as principais áreas do sistema passo a passo.`

Ação:

`Ver área de tutoriais`

Destino:

`/ajuda/tutoriais`

Pode mostrar um selo discreto:

`Disponível`

#### Card 2 — Documentação

Título:

`Documentação`

Descrição:

`Pesquise artigos e abra os guias oficiais publicados para o <Nome do Projeto>.`

Ação:

`Consultar documentação`

Destino:

`/ajuda/documentacao`

Pode mostrar o mesmo selo discreto:

`Disponível`

### Perguntas frequentes

Abaixo do bloco principal, criar a área visual de FAQ.

Título:

`Perguntas frequentes`

Descrição:

`Respostas rápidas publicadas na documentação oficial do <Nome do Projeto>.`

Prepare:

- área horizontal para filtros de categoria;
- container para accordions;
- botão futuro de expandir/recolher lista.

Mas neste primeiro passo:

- NÃO criar categorias fictícias;
- NÃO criar perguntas fictícias;
- NÃO hardcodar respostas;
- NÃO conectar `help-index.json`.

Se precisar renderizar algo enquanto não há dados, use somente um estado vazio neutro e discreto.

==================================================
5. DOCUMENTAÇÃO — `/ajuda/documentacao`
==================================================

### Barra superior

Título:

`Documentação`

Subtítulo:

`Artigos e guias da documentação do <Nome do Projeto>`

Botão:

`Voltar`

Destino:

`/ajuda`

### Bloco principal

Usar ícone simples de livro/documento.

Título:

`Encontre a informação de que precisa`

Descrição:

`Pesquise em toda a Central de ajuda ou explore a documentação por categoria.`

Mostrar a mesma barra de pesquisa da Central logo abaixo.

Placeholder:

`Pesquisar tutoriais, artigos e perguntas frequentes...`

Neste primeiro passo ela ainda não consulta artigos.

### Botão abaixo da busca

Logo abaixo da barra de pesquisa, incluir obrigatoriamente o botão:

`Abrir documentação completa`

Destino:

`/docs/`

Abrir em nova aba:

`target="_blank"`
`rel="noopener noreferrer"`

Esse botão já deve funcionar neste primeiro passo.

### Explorar por categoria

Criar a seção:

Título:

`Explorar por categoria`

Descrição:

`Escolha uma área da documentação para consultar os respectivos guias.`

Preparar exatamente duas categorias:

- `Referência`
- `Usabilidade`

Não criar Arquitetura.

Os dois cards fazem parte da estrutura da Central e podem existir antes da integração.

Neste primeiro passo:

- não inventar quantidade de artigos;
- não inventar resumo da categoria;
- não inventar artigos;
- não conectar documentação.

No desktop os dois cards ficam lado a lado.
No mobile ficam empilhados.

Ao selecionar um card, deixe a interface preparada para mostrar a lista daquela categoria abaixo.

### Lista de artigos

Criar a estrutura visual que futuramente receberá os artigos da categoria selecionada.

Cada linha futura deve comportar:

- ícone simples de documento;
- título;
- resumo curto;
- seta/indicador à direita.

Neste passo, não criar artigos fictícios.

==================================================
6. TUTORIAIS — `/ajuda/tutoriais`
==================================================

IMPORTANTE:
Esta página pertence a outro processo.
Ela deve ser criada visualmente, mas NÃO deve receber dados da documentação e NÃO deve possuir tutoriais fictícios.

### Barra superior

Título:

`Tutoriais e visitas guiadas`

Subtítulo:

`Percursos interativos para aprender a utilizar o sistema`

Botão:

`Voltar`

Destino:

`/ajuda`

### Bloco principal

Usar ícone simples relacionado a aprendizado/tutorial.

Título:

`Aprenda no seu ritmo`

Descrição:

`Consulte percursos e temas guiados para conhecer as principais áreas do <Nome do Projeto>.`

Manter a barra de pesquisa no topo para preservar o padrão visual da Central.

Neste momento ela não recebe fonte de tutoriais e não deve consultar a documentação.

### Estrutura abaixo do bloco principal

Criar somente as duas divisões abaixo.

#### Os seus percursos

Descrição:

`Percursos completos para aprender as principais tarefas do sistema.`

Deixar vazio.

Não criar:

- cards;
- módulos;
- progresso;
- dados de demonstração;
- tutorial falso.

#### Explorar por tema

Descrição:

`Encontre um tema específico quando não precisar fazer um percurso completo.`

Também deixar vazio.

A página precisa parecer pronta para receber o mecanismo de tutoriais futuramente, sem mensagens exageradas de “em construção”.

==================================================
7. PADRÃO VISUAL
==================================================

A estrutura visual principal deve ser exatamente esta:

Central de ajuda
│
├── Como podemos ajudar?
│   └── [ Pesquisa ]
│
├── [ Tutoriais e visitas guiadas ] [ Documentação ]
│
└── Perguntas frequentes
    └── estrutura vazia preparada para dados

Documentação
│
├── Voltar
├── Encontre a informação de que precisa
│   ├── [ Pesquisa ]
│   └── [ Abrir documentação completa ]
│
├── Explorar por categoria
│   ├── [ Referência ]
│   └── [ Usabilidade ]
│
└── Lista de artigos
    └── vazia até o Passo 2

Tutoriais e visitas guiadas
│
├── Voltar
├── Aprenda no seu ritmo
│   └── [ Pesquisa ]
│
├── Os seus percursos
│   └── vazio
│
└── Explorar por tema
    └── vazio

Características visuais:

- bastante espaço em branco;
- superfícies brancas ou cinza muito claro;
- bordas finas;
- cantos arredondados discretos;
- ícones simples;
- títulos pequenos e fortes;
- descrições curtas;
- busca larga e centralizada;
- cards sem decoração excessiva;
- layout responsivo;
- hierarquia visual clara.

==================================================
8. ACESSIBILIDADE
==================================================

Garantir:

- navegação por teclado;
- foco visível;
- botões com `type="button"` quando apropriado;
- labels acessíveis na busca;
- `aria-expanded` onde houver accordion preparado;
- links externos com `rel="noopener noreferrer"`;
- responsividade sem perda de conteúdo.

==================================================
9. O QUE NÃO FAZER NESTE PASSO
==================================================

- Não buscar `/docs/help-index.json`.
- Não ler arquivos Markdown da documentação.
- Não hardcodar FAQs.
- Não hardcodar artigos.
- Não criar uma lista falsa de documentação.
- Não criar tutoriais.
- Não ligar a busca aos tutoriais.
- Não ligar a busca à documentação ainda.
- Não criar Arquitetura na Central.
- Não alterar `/docs/`.
- Não duplicar o portal de documentação dentro da aplicação.
- Não copiar texto, nome, rota ou branding de outro projeto.

==================================================
10. CRITÉRIOS DE ACEITAÇÃO
==================================================

Considere este primeiro passo concluído quando:

1. `/ajuda` existe e possui:
   - barra superior;
   - bloco “Como podemos ajudar?”;
   - barra de pesquisa;
   - card Tutoriais;
   - card Documentação;
   - estrutura visual da seção Perguntas frequentes.

2. `/ajuda/documentacao` existe e possui:
   - Voltar;
   - bloco principal;
   - pesquisa;
   - botão “Abrir documentação completa”;
   - cards Referência e Usabilidade;
   - estrutura vazia para a lista de artigos.

3. `/ajuda/tutoriais` existe e possui:
   - Voltar;
   - bloco principal;
   - barra de pesquisa;
   - “Os seus percursos” vazio;
   - “Explorar por tema” vazio.

4. Nenhum conteúdo fictício foi criado.

5. Nenhuma fonte de documentação foi conectada ainda.

6. Toda a interface está em Português (Brasil).

7. O visual está integrado ao design existente do projeto.

8. Não existe nenhuma referência textual, visual ou estrutural hardcoded a outro projeto.

Ao terminar, liste somente:
- arquivos criados;
- arquivos alterados;
- rotas adicionadas;
- componentes reutilizáveis criados;
- qualquer limitação real encontrada.
```
