import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";

// Mantém os filtros aplicados e a página atual na query string da URL.
//
// Sem isso, quem estava no meio de uma triagem perdia a busca inteira toda
// vez que abria os detalhes de um registro e voltava. Guardando na URL, três
// coisas passam a funcionar de graça: o botão "Voltar" da tela de detalhes,
// o botão voltar do navegador e o F5 — além de dar pra mandar o link da
// busca pra outra pessoa.
//
// Usado por Anuidades, Contratos e Contas a receber, pra que as três telas
// se comportem igual.

function lerFiltrosDaUrl(search, filtrosPadrao) {
  const params = new URLSearchParams(search);

  return Object.fromEntries(
    Object.entries(filtrosPadrao).map(([campo, padrao]) => [
      campo,
      params.get(campo) ?? padrao,
    ]),
  );
}

function lerPaginaDaUrl(search) {
  const pagina = Number(new URLSearchParams(search).get("pagina"));

  return Number.isInteger(pagina) && pagina > 0 ? pagina : 1;
}

// "TODOS" e "" são os valores neutros dos filtros — ficam fora da URL pra
// ela não virar um amontoado de parâmetros vazios.
function montarUrlDosFiltros(filtrosAplicados, pagina) {
  const params = new URLSearchParams();

  Object.entries(filtrosAplicados).forEach(([campo, valor]) => {
    if (valor !== "" && valor !== "TODOS") params.set(campo, valor);
  });

  if (pagina > 1) params.set("pagina", String(pagina));

  const query = params.toString();

  return query ? `?${query}` : "";
}

export function useFiltrosNaUrl(filtrosPadrao) {
  const location = useLocation();
  const navigate = useNavigate();

  const [filters, setFilters] = useState(() =>
    lerFiltrosDaUrl(location.search, filtrosPadrao),
  );
  const [appliedFilters, setAppliedFilters] = useState(() =>
    lerFiltrosDaUrl(location.search, filtrosPadrao),
  );
  const [currentPage, setCurrentPage] = useState(() =>
    lerPaginaDaUrl(location.search),
  );

  useEffect(() => {
    const search = montarUrlDosFiltros(appliedFilters, currentPage);

    // replace (e não push) pra que o botão voltar do navegador saia da
    // listagem, em vez de percorrer cada filtro que a pessoa testou.
    if (search !== location.search) {
      navigate({ pathname: location.pathname, search }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedFilters, currentPage]);

  return {
    filters,
    setFilters,
    appliedFilters,
    setAppliedFilters,
    currentPage,
    setCurrentPage,
    // Repassado aos links de detalhes: é o que a tela de detalhes usa pra
    // devolver a pessoa à mesma listagem.
    listSearch: location.search,
  };
}
