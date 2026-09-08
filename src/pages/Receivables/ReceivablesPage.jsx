import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  FileSearch,
  FileText,
  FilterX,
  Hash,
  ReceiptText,
  RefreshCw,
  Search,
  UserRound,
  WalletCards,
  XCircle,
} from "lucide-react";
import { Link } from "react-router";

import { useFiltrosNaUrl } from "../../hooks/useFiltrosNaUrl";

import { Pagination } from "../../components/ui/Pagination";
import { getApiErrorMessage } from "../../services/apiError";
import { receivablesService } from "../../services/receivablesService";

const PAGE_SIZE = 20;
const initialFilters = {
  numeroDocumento: "",
  contratoId: "",
  anuidadeId: "",
  pagadorClienteId: "",
  situacao: "",
  vencimentoInicial: "",
  vencimentoFinal: "",
  boleto: "TODOS",
  pagamento: "TODOS",
};
const initialResult = {
  items: [],
  totalRegistros: 0,
  numeroPagina: 1,
  totalPaginas: 1,
  temPaginaAnterior: false,
  temProximaPagina: false,
};

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function ReceivablesPage() {
  const {
    filters,
    setFilters,
    appliedFilters,
    setAppliedFilters,
    currentPage,
    setCurrentPage,
    listSearch,
  } = useFiltrosNaUrl(initialFilters);
  const [reloadToken, setReloadToken] = useState(0);
  const [result, setResult] = useState(initialResult);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [filterError, setFilterError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadReceivables() {
      setIsLoading(true);
      setLoadError("");

      try {
        const response = await receivablesService.list({
          ...appliedFilters,
          numeroPagina: currentPage,
          tamanhoPagina: PAGE_SIZE,
        });

        if (active) setResult(response);
      } catch (error) {
        if (active) {
          setLoadError(
            getApiErrorMessage(
              error,
              "Não foi possível carregar as contas a receber.",
            ),
          );
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }

    loadReceivables();

    return () => {
      active = false;
    };
  }, [appliedFilters, currentPage, reloadToken]);

  const pageStatistics = useMemo(
    () =>
      result.items.reduce(
        (statistics, receivable) => ({
          original: statistics.original + receivable.valorOriginal,
          open: statistics.open + receivable.valorAberto,
          paid: statistics.paid + (receivable.pago ? 1 : 0),
        }),
        { original: 0, open: 0, paid: 0 },
      ),
    [result.items],
  );

  const hasAppliedFilters = Object.values(appliedFilters).some(
    (value) => value !== "" && value !== "TODOS",
  );
  const hasDraftFilters = Object.values(filters).some(
    (value) => value !== "" && value !== "TODOS",
  );

  function handleFilterChange(event) {
    const { name, value } = event.target;
    setFilters((current) => ({ ...current, [name]: value }));
    setFilterError("");
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (
      filters.vencimentoInicial &&
      filters.vencimentoFinal &&
      filters.vencimentoInicial > filters.vencimentoFinal
    ) {
      setFilterError(
        "O vencimento inicial não pode ser posterior ao vencimento final.",
      );
      return;
    }

    setFilterError("");
    setCurrentPage(1);
    setAppliedFilters({ ...filters });
  }

  function clearFilters() {
    setFilters(initialFilters);
    setAppliedFilters(initialFilters);
    setFilterError("");
    setCurrentPage(1);
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-5 rounded-3xl border border-[#e7e1e9] bg-white p-5 shadow-[0_8px_30px_rgba(56,32,65,0.04)] sm:p-6 lg:flex-row lg:items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.17em] text-[#754286]">
            Gestão financeira
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-[#2d2530]">
            Contas a receber
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#817688]">
            Consulte cobranças, vencimentos, valores em aberto e vínculos com
            contratos, anuidades e pagadores.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setReloadToken((current) => current + 1)}
          disabled={isLoading}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-[#dcd4df] bg-white px-4 text-sm font-bold text-[#432059] transition hover:border-[#432059] hover:bg-[#f8f4fa] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
          Atualizar dados
        </button>
      </section>

      {loadError && (
        <Alert title="Não foi possível carregar as contas a receber">
          {loadError}
        </Alert>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatisticCard
          label="Contas encontradas"
          value={result.totalRegistros}
          icon={WalletCards}
          iconClassName="bg-[#f0e8f3] text-[#432059]"
        />
        <StatisticCard
          label="Valor original nesta página"
          value={currencyFormatter.format(pageStatistics.original)}
          icon={CircleDollarSign}
          iconClassName="bg-blue-50 text-blue-700"
          compact
        />
        <StatisticCard
          label="Valor em aberto nesta página"
          value={currencyFormatter.format(pageStatistics.open)}
          icon={Banknote}
          iconClassName="bg-amber-50 text-amber-700"
          compact
        />
        <StatisticCard
          label="Pagas nesta página"
          value={pageStatistics.paid}
          icon={CheckCircle2}
          iconClassName="bg-emerald-50 text-emerald-700"
        />
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#e7e1e9] bg-white shadow-[0_8px_30px_rgba(56,32,65,0.04)]">
        <form
          onSubmit={handleSubmit}
          className="grid gap-3 border-b border-[#eee9f0] p-4 sm:p-5 md:grid-cols-2 xl:grid-cols-4"
        >
          <FilterField icon={FileText}>
            <input
              name="numeroDocumento"
              value={filters.numeroDocumento}
              onChange={handleFilterChange}
              placeholder="Número do documento"
              className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-[#aaa1ae]"
            />
          </FilterField>
          <FilterField icon={Hash}>
            <input
              name="contratoId"
              type="number"
              min="1"
              value={filters.contratoId}
              onChange={handleFilterChange}
              placeholder="Código do contrato"
              className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-[#aaa1ae]"
            />
          </FilterField>
          <FilterField icon={ReceiptText}>
            <input
              name="anuidadeId"
              type="number"
              min="1"
              value={filters.anuidadeId}
              onChange={handleFilterChange}
              placeholder="Código da anuidade"
              className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-[#aaa1ae]"
            />
          </FilterField>
          <FilterField icon={UserRound}>
            <input
              name="pagadorClienteId"
              type="number"
              min="1"
              value={filters.pagadorClienteId}
              onChange={handleFilterChange}
              placeholder="Código do pagador"
              className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-[#aaa1ae]"
            />
          </FilterField>
          <FilterField icon={Search}>
            <input
              name="situacao"
              value={filters.situacao}
              onChange={handleFilterChange}
              placeholder="Situação"
              className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-[#aaa1ae]"
            />
          </FilterField>
          <FilterField icon={CalendarDays}>
            <input
              name="vencimentoInicial"
              type="date"
              value={filters.vencimentoInicial}
              onChange={handleFilterChange}
              aria-label="Vencimento inicial"
              className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm text-[#625766] outline-none"
            />
          </FilterField>
          <FilterField icon={CalendarDays}>
            <input
              name="vencimentoFinal"
              type="date"
              value={filters.vencimentoFinal}
              onChange={handleFilterChange}
              aria-label="Vencimento final"
              className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm text-[#625766] outline-none"
            />
          </FilterField>
          <div className="grid grid-cols-2 gap-3">
            <FilterSelect
              name="boleto"
              value={filters.boleto}
              onChange={handleFilterChange}
              options={[
                ["TODOS", "Todos os boletos"],
                ["GERADO", "Boleto gerado"],
                ["NAO_GERADO", "Sem boleto"],
              ]}
            />
            <FilterSelect
              name="pagamento"
              value={filters.pagamento}
              onChange={handleFilterChange}
              options={[
                ["TODOS", "Todos os pagamentos"],
                ["PAGO", "Pagas"],
                ["EM_ABERTO", "Em aberto"],
              ]}
            />
          </div>

          {filterError && (
            <p className="text-sm font-semibold text-red-600 md:col-span-2 xl:col-span-4">
              {filterError}
            </p>
          )}

          <div className="flex gap-2 md:col-span-2 xl:col-span-4 xl:justify-end">
            <button
              type="submit"
              className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#432059] px-5 text-sm font-bold text-white transition hover:bg-[#341366] xl:flex-none"
            >
              <Search size={18} />
              Buscar contas
            </button>
            {(hasAppliedFilters || hasDraftFilters) && (
              <button
                type="button"
                onClick={clearFilters}
                className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#ded8e2] text-[#766c7a] transition hover:border-[#432059] hover:bg-[#f8f4fa] hover:text-[#432059]"
                aria-label="Limpar filtros"
              >
                <FilterX size={19} />
              </button>
            )}
          </div>
        </form>

        {isLoading ? (
          <LoadingState />
        ) : result.items.length === 0 ? (
          <EmptyState hasFilters={hasAppliedFilters} onClear={clearFilters} />
        ) : (
          <>
            <ReceivablesTable receivables={result.items} listSearch={listSearch} />
            <ReceivablesCards receivables={result.items} listSearch={listSearch} />
            <Pagination
              currentPage={result.numeroPagina ?? currentPage}
              totalPages={Math.max(result.totalPaginas ?? 1, 1)}
              totalRecords={result.totalRegistros}
              canGoBack={result.temPaginaAnterior}
              canGoForward={result.temProximaPagina}
              onPrevious={() =>
                setCurrentPage((page) => Math.max(1, page - 1))
              }
              onNext={() => setCurrentPage((page) => page + 1)}
              onPageChange={setCurrentPage}
              itemLabelSingular="conta encontrada"
              itemLabelPlural="contas encontradas"
            />
          </>
        )}
      </section>
    </div>
  );
}

function Alert({ title, children }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-red-700">
      <AlertTriangle size={20} className="mt-0.5 shrink-0" />
      <div><p className="text-sm font-bold">{title}</p><p className="mt-1 text-sm leading-6">{children}</p></div>
    </div>
  );
}

function ReceivablesTable({ receivables, listSearch }) {
  return (
    <div className="hidden overflow-x-auto xl:block">
      <table className="w-full border-collapse">
        <thead className="bg-[#faf8fb]">
          <tr>
            <TableHeading>Documento</TableHeading><TableHeading>Vínculos</TableHeading><TableHeading>Vencimento</TableHeading><TableHeading>Valor original</TableHeading><TableHeading>Valor aberto</TableHeading><TableHeading>Situação</TableHeading><TableHeading>Boleto</TableHeading><TableHeading>Pagamento</TableHeading><TableHeading>Ações</TableHeading>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#f0ecf2]">
          {receivables.map((receivable) => (
            <tr key={receivable.id} className="transition hover:bg-[#fcfafc]">
              <td className="px-5 py-4"><ReceivableIdentity receivable={receivable} /></td>
              <td className="px-5 py-4"><Links receivable={receivable} /></td>
              <TableCell>{formatDate(receivable.dataVencimento)}</TableCell>
              <TableCell strong>{currencyFormatter.format(receivable.valorOriginal)}</TableCell>
              <TableCell strong>{currencyFormatter.format(receivable.valorAberto)}</TableCell>
              <td className="px-5 py-4"><SituationBadge value={receivable.situacao} /></td>
              <td className="px-5 py-4"><BooleanBadge value={receivable.boletoGerado} positive="Gerado" negative="Não gerado" /></td>
              <td className="px-5 py-4"><PaymentBadge paid={receivable.pago} /></td>
              <td className="px-5 py-4"><DetailsLink receivableId={receivable.id} backSearch={listSearch} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReceivablesCards({ receivables, listSearch }) {
  return (
    <div className="divide-y divide-[#f0ecf2] xl:hidden">
      {receivables.map((receivable) => (
        <article key={receivable.id} className="p-5">
          <div className="flex items-start justify-between gap-3"><ReceivableIdentity receivable={receivable} /><PaymentBadge paid={receivable.pago} /></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Information label="Vencimento" value={formatDate(receivable.dataVencimento)} />
            <Information label="Valor original" value={currencyFormatter.format(receivable.valorOriginal)} />
            <Information label="Valor aberto" value={currencyFormatter.format(receivable.valorAberto)} />
            <Information label="Situação" value={receivable.situacao || "Não informada"} />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2"><Links receivable={receivable} /><BooleanBadge value={receivable.boletoGerado} positive="Boleto gerado" negative="Sem boleto" /></div>
          <DetailsLink receivableId={receivable.id} fullWidth backSearch={listSearch} />
        </article>
      ))}
    </div>
  );
}

function ReceivableIdentity({ receivable }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ede4f1] text-[#5d276d]"><Banknote size={19} /></div>
      <div className="min-w-0"><p className="truncate text-sm font-bold text-[#342b37]">{receivable.numeroDocumento || `Conta #${receivable.id}`}</p><p className="mt-1 truncate text-xs text-[#928895]">Parcela {receivable.numeroParcela || "não informada"} · Pagador #{receivable.pagadorClienteId}</p></div>
    </div>
  );
}

function Links({ receivable }) {
  return (
    <div className="flex flex-wrap gap-2">
      <SmallLink to={`/contratos/${receivable.contratoId}`} label={`Contrato #${receivable.contratoId}`} />
      {receivable.anuidadeId && <SmallLink to={`/anuidades/${receivable.anuidadeId}`} label={`Anuidade #${receivable.anuidadeId}`} />}
      <SmallLink to={`/clientes/${receivable.pagadorClienteId}`} label={`Pagador #${receivable.pagadorClienteId}`} />
    </div>
  );
}

function SmallLink({ to, label }) {
  return <Link to={to} className="rounded-lg border border-[#e2dbe5] bg-white px-2.5 py-1.5 text-[11px] font-bold text-[#653475] transition hover:border-[#432059] hover:bg-[#f8f4fa]">{label}</Link>;
}

function DetailsLink({ receivableId, fullWidth = false, backSearch = "" }) {
  return (
    <Link
      to={`/contas-receber/${receivableId}`}
      // Leva a busca atual junto, pro "Voltar" da tela de detalhes
      // devolver a listagem como estava.
      state={{ listSearch: backSearch }}
      className={`inline-flex h-10 items-center justify-center rounded-xl border border-[#dcd4df] px-4 text-xs font-bold text-[#5d276d] transition hover:border-[#432059] hover:bg-[#f8f4fa] ${fullWidth ? "mt-4 w-full" : ""}`}
    >
      Detalhes
    </Link>
  );
}

function PaymentBadge({ paid }) {
  return <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-bold ${paid ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>{paid ? <CheckCircle2 size={13} /> : <XCircle size={13} />}{paid ? "Pago" : "Em aberto"}</span>;
}

function BooleanBadge({ value, positive, negative }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${value ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-slate-50 text-slate-600"}`}>{value ? positive : negative}</span>;
}

function SituationBadge({ value }) {
  return <span className="inline-flex rounded-full border border-[#ded4e2] bg-[#f7f3f8] px-2.5 py-1 text-xs font-bold text-[#684974]">{value || "Não informada"}</span>;
}

function formatDate(value) {
  if (!value) return "Não informado";
  return dateFormatter.format(new Date(`${value}T00:00:00Z`));
}

function FilterField({ icon: Icon, children }) {
  return <div className="flex h-12 items-center rounded-xl border border-[#ded8e2] bg-white text-[#8b818f] transition focus-within:border-[#432059] focus-within:ring-4 focus-within:ring-[#432059]/10"><Icon size={18} className="ml-4 shrink-0" />{children}</div>;
}

function FilterSelect({ options, ...props }) {
  return <select {...props} className="h-12 min-w-0 rounded-xl border border-[#ded8e2] bg-white px-3 text-xs font-semibold text-[#5d5361] outline-none transition focus:border-[#432059] focus:ring-4 focus:ring-[#432059]/10">{options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>;
}

function StatisticCard({ label, value, icon: Icon, iconClassName, compact = false }) {
  return <article className="rounded-2xl border border-[#e7e1e9] bg-white p-5 shadow-[0_8px_30px_rgba(56,32,65,0.04)]"><div className="flex items-center justify-between gap-4"><div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconClassName}`}><Icon size={21} /></div><p className={`${compact ? "text-xl" : "text-3xl"} text-right font-bold tracking-[-0.04em] text-[#302733]`}>{value}</p></div><p className="mt-4 text-sm font-semibold text-[#817688]">{label}</p></article>;
}

function TableHeading({ children }) {
  return <th className="whitespace-nowrap px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-[0.13em] text-[#8d8391]">{children}</th>;
}

function TableCell({ children, strong = false }) {
  return <td className={`whitespace-nowrap px-5 py-4 text-sm ${strong ? "font-bold text-[#413646]" : "text-[#756a79]"}`}>{children}</td>;
}

function Information({ label, value }) {
  return <div className="rounded-xl bg-[#faf8fb] p-3"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#988e9c]">{label}</p><p className="mt-1.5 text-xs font-semibold text-[#554b59]">{value}</p></div>;
}

function LoadingState() {
  return <div className="space-y-3 p-5" aria-label="Carregando contas a receber">{[1, 2, 3, 4].map((item) => <div key={item} className="h-16 animate-pulse rounded-2xl bg-[#f3eff4]" />)}</div>;
}

function EmptyState({ hasFilters, onClear }) {
  return <div className="flex min-h-72 flex-col items-center justify-center px-5 py-12 text-center"><div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f0e8f3] text-[#432059]"><FileSearch size={28} /></div><h3 className="mt-5 text-lg font-bold text-[#342b37]">Nenhuma conta a receber encontrada</h3><p className="mt-2 max-w-md text-sm leading-6 text-[#817688]">{hasFilters ? "Revise os filtros utilizados ou faça uma nova pesquisa." : "A API ainda não retornou contas a receber para esta consulta."}</p>{hasFilters && <button type="button" onClick={onClear} className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl border border-[#dcd4df] px-4 text-sm font-bold text-[#432059] transition hover:border-[#432059] hover:bg-[#f8f4fa]"><FilterX size={18} />Limpar filtros</button>}</div>;
}
