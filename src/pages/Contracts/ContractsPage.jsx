import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  FileCheck2,
  FileSearch,
  FileText,
  FilterX,
  Hash,
  Eye,
  LoaderCircle,
  RefreshCw,
  Search,
  UserRound,
  XCircle,
} from "lucide-react";
import { Link } from "react-router";

// `contrato.ativo` é um campo do banco que nunca é reescrito por nenhum
// sync com a Omie (fica congelado desde a importação) — por isso ele podia
// mostrar "Inativo" para um contrato com situação "Ativo" vinda da Omie.
// O selo passa a se basear na própria situação, que é o campo realmente
// atualizado.
function contratoEstaAtivo(situacao) {
  return (situacao ?? "").trim().toLowerCase() === "ativo";
}

import { useFiltrosNaUrl } from "../../hooks/useFiltrosNaUrl";

import { Modal } from "../../components/ui/Modal";
import { Pagination } from "../../components/ui/Pagination";
import { useAuth } from "../../contexts/AuthContext";
import { annualitiesService } from "../../services/annualitiesService";
import { getApiErrorMessage } from "../../services/apiError";
import { contractsService } from "../../services/contractsService";

const PAGE_SIZE = 20;
const initialFilters = {
  numero: "",
  letra: "",
  anoContrato: "",
  anoReferencia: "",
  situacao: "",
  status: "TODOS",
  anualidade: "TODOS",
};
const initialResult = {
  items: [],
  totalRegistros: 0,
  numeroPagina: 1,
  totalPaginas: 1,
  temPaginaAnterior: false,
  temProximaPagina: false,
};

export function ContractsPage() {
  const { hasPermission } = useAuth();
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
  const [selectedContractIds, setSelectedContractIds] = useState([]);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const [generationResult, setGenerationResult] = useState(null);

  const canGenerateAnnualities = hasPermission("ANUIDADES_VISUALIZAR");

  useEffect(() => {
    let active = true;

    async function loadContracts() {
      setIsLoading(true);
      setLoadError("");
      try {
        const response = await contractsService.list({
          numero: appliedFilters.numero,
          letra: appliedFilters.letra,
          anoContrato: appliedFilters.anoContrato,
          anoReferencia: appliedFilters.anoReferencia,
          situacao: appliedFilters.situacao,
          ativo:
            appliedFilters.status === "ATIVO"
              ? true
              : appliedFilters.status === "INATIVO"
                ? false
                : undefined,
          possuiAnuidade:
            appliedFilters.anualidade === "COM_ANUIDADE"
              ? true
              : appliedFilters.anualidade === "SEM_ANUIDADE"
                ? false
                : undefined,
          numeroPagina: currentPage,
          tamanhoPagina: PAGE_SIZE,
        });
        if (active) setResult(response);
      } catch (error) {
        if (active) {
          setLoadError(
            getApiErrorMessage(error, "Não foi possível carregar os contratos."),
          );
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }

    loadContracts();
    return () => {
      active = false;
    };
  }, [appliedFilters, currentPage, reloadToken]);

  useEffect(() => {
    setSelectedContractIds([]);
  }, [appliedFilters, currentPage, reloadToken]);

  const pageStatistics = useMemo(
    () => ({
      active: result.items.filter((contract) =>
        contratoEstaAtivo(contract.situacao),
      ).length,
      withAnnuality: result.items.filter(
        (contract) => contract.possuiAnuidade,
      ).length,
      withoutAnnuality: result.items.filter(
        (contract) => !contract.possuiAnuidade,
      ).length,
    }),
    [result.items],
  );
  const eligiblePageContracts = useMemo(
    () => result.items.filter((contract) => !contract.possuiAnuidade),
    [result.items],
  );
  const selectedContracts = useMemo(
    () =>
      result.items.filter((contract) =>
        selectedContractIds.includes(contract.id),
      ),
    [result.items, selectedContractIds],
  );
  const allEligiblePageSelected =
    eligiblePageContracts.length > 0 &&
    eligiblePageContracts.every((contract) =>
      selectedContractIds.includes(contract.id),
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
  }

  function handleSubmit(event) {
    event.preventDefault();
    setCurrentPage(1);
    setAppliedFilters({ ...filters });
  }

  function clearFilters() {
    setFilters(initialFilters);
    setAppliedFilters(initialFilters);
    setCurrentPage(1);
  }

  function toggleContractSelection(contractId) {
    setSelectedContractIds((current) =>
      current.includes(contractId)
        ? current.filter((id) => id !== contractId)
        : [...current, contractId],
    );
  }

  function toggleAllEligibleOnPage() {
    setSelectedContractIds(
      allEligiblePageSelected
        ? []
        : eligiblePageContracts.map((contract) => contract.id),
    );
  }

  function openGenerateModal() {
    if (selectedContractIds.length === 0) return;
    setGenerateError("");
    setShowGenerateModal(true);
  }

  function closeGenerateModal() {
    if (isGenerating) return;
    setShowGenerateModal(false);
    setGenerateError("");
  }

  async function handleGenerateAnnualities() {
    if (selectedContractIds.length === 0) return;

    setIsGenerating(true);
    setGenerateError("");
    setGenerationResult(null);

    try {
      const generated = await annualitiesService.gerarEmMassa(
        "",
        selectedContractIds,
      );

      setGenerationResult(generated);
      setShowGenerateModal(false);
      setSelectedContractIds([]);
      setReloadToken((current) => current + 1);
    } catch (error) {
      setGenerateError(
        getApiErrorMessage(
          error,
          "Não foi possível gerar as anuidades selecionadas.",
        ),
      );
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-5 rounded-3xl border border-[#e7e1e9] bg-white p-5 shadow-[0_8px_30px_rgba(56,32,65,0.04)] sm:p-6 lg:flex-row lg:items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.17em] text-[#754286]">
            Gestão financeira
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-[#2d2530]">
            Contratos
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#817688]">
            Consulte contratos, acompanhe sua situação e identifique quais
            registros possuem anuidades vinculadas.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          {canGenerateAnnualities && selectedContractIds.length > 0 && (
            <button
              type="button"
              onClick={openGenerateModal}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#432059] px-4 text-sm font-bold text-white transition hover:bg-[#341366]"
            >
              <CalendarPlus size={18} />
              Gerar anuidades selecionadas ({selectedContractIds.length})
            </button>
          )}
          <button
            type="button"
            onClick={() => setReloadToken((current) => current + 1)}
            disabled={isLoading}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#dcd4df] bg-white px-4 text-sm font-bold text-[#432059] transition hover:border-[#432059] hover:bg-[#f8f4fa] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
            Atualizar dados
          </button>
        </div>
      </section>

      {loadError && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-red-700"
        >
          <AlertTriangle size={20} className="mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-bold">
              Não foi possível carregar os contratos
            </p>
            <p className="mt-1 text-sm leading-6">{loadError}</p>
          </div>
        </div>
      )}

      {generationResult && (
        <GenerationResult
          result={generationResult}
          onClose={() => setGenerationResult(null)}
        />
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatisticCard
          label="Contratos encontrados"
          value={result.totalRegistros}
          icon={FileText}
          iconClassName="bg-[#f0e8f3] text-[#432059]"
        />
        <StatisticCard
          label="Ativos nesta página"
          value={pageStatistics.active}
          icon={CheckCircle2}
          iconClassName="bg-emerald-50 text-emerald-700"
        />
        <StatisticCard
          label="Com anuidade nesta página"
          value={pageStatistics.withAnnuality}
          icon={FileCheck2}
          iconClassName="bg-blue-50 text-blue-700"
        />
        <StatisticCard
          label="Sem anuidade nesta página"
          value={pageStatistics.withoutAnnuality}
          icon={XCircle}
          iconClassName="bg-amber-50 text-amber-700"
        />
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#e7e1e9] bg-white shadow-[0_8px_30px_rgba(56,32,65,0.04)]">
        <form
          onSubmit={handleSubmit}
          className="grid gap-3 border-b border-[#eee9f0] p-4 sm:p-5 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7"
        >
          <FilterField icon={Hash}>
            <input
              name="numero"
              value={filters.numero}
              onChange={handleFilterChange}
              placeholder="Número do contrato"
              className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-[#aaa1ae]"
            />
          </FilterField>
          <FilterField icon={FileText}>
            <input
              name="letra"
              value={filters.letra}
              onChange={handleFilterChange}
              placeholder="Letra"
              className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-[#aaa1ae]"
            />
          </FilterField>
          <FilterField icon={CalendarDays}>
            <input
              name="anoContrato"
              type="number"
              min="1"
              value={filters.anoContrato}
              onChange={handleFilterChange}
              placeholder="Ano do contrato"
              className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-[#aaa1ae]"
            />
          </FilterField>
          <FilterField icon={CalendarDays}>
            <input
              name="anoReferencia"
              type="number"
              min="2000"
              max="2200"
              value={filters.anoReferencia}
              onChange={handleFilterChange}
              placeholder="Ano da anuidade"
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
          <select
            name="status"
            value={filters.status}
            onChange={handleFilterChange}
            className="h-12 rounded-xl border border-[#ded8e2] bg-white px-3 text-sm font-semibold text-[#5d5361] outline-none transition focus:border-[#432059] focus:ring-4 focus:ring-[#432059]/10"
          >
            <option value="TODOS">Todos os status</option>
            <option value="ATIVO">Ativos</option>
            <option value="INATIVO">Inativos</option>
          </select>
          <select
            name="anualidade"
            value={filters.anualidade}
            onChange={handleFilterChange}
            className="h-12 rounded-xl border border-[#ded8e2] bg-white px-3 text-sm font-semibold text-[#5d5361] outline-none transition focus:border-[#432059] focus:ring-4 focus:ring-[#432059]/10"
          >
            <option value="TODOS">Todas as anuidades</option>
            <option value="COM_ANUIDADE">Com anuidade</option>
            <option value="SEM_ANUIDADE">Sem anuidade</option>
          </select>
          <div className="flex gap-2 md:col-span-2 xl:col-span-4 2xl:col-span-7 2xl:justify-end">
            <button
              type="submit"
              className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#432059] px-5 text-sm font-bold text-white transition hover:bg-[#341366] 2xl:flex-none"
            >
              <Search size={18} />
              Buscar contratos
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
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full border-collapse">
                <thead className="bg-[#faf8fb]">
                  <tr>
                    {canGenerateAnnualities && (
                      <TableHeading>
                        <input
                          type="checkbox"
                          checked={allEligiblePageSelected}
                          onChange={toggleAllEligibleOnPage}
                          disabled={eligiblePageContracts.length === 0}
                          aria-label="Selecionar todos os contratos sem anuidade desta página"
                          className="h-4 w-4 rounded border-[#ded8e2] accent-[#432059]"
                        />
                      </TableHeading>
                    )}
                    <TableHeading>Contrato</TableHeading>
                    <TableHeading>Titular</TableHeading>
                    <TableHeading>Ano</TableHeading>
                    <TableHeading>Situação</TableHeading>
                    <TableHeading>Status</TableHeading>
                    <TableHeading>Anuidade</TableHeading>
                    <TableHeading align="right">Ações</TableHeading>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0ecf2]">
                  {result.items.map((contract) => (
                    <tr
                      key={contract.id}
                      className={`transition hover:bg-[#fcfafc] ${
                        selectedContractIds.includes(contract.id)
                          ? "bg-[#f8f3fa]"
                          : ""
                      }`}
                    >
                      {canGenerateAnnualities && (
                        <td className="px-5 py-4">
                          <ContractCheckbox
                            contract={contract}
                            checked={selectedContractIds.includes(contract.id)}
                            onChange={() =>
                              toggleContractSelection(contract.id)
                            }
                          />
                        </td>
                      )}
                      <td className="px-5 py-4">
                        <ContractIdentity contract={contract} />
                      </td>
                      <td className="px-5 py-4">
                        <ContractHolder holder={contract.titular} />
                      </td>
                      <td className="px-5 py-4 text-sm font-semibold text-[#615766]">
                        {contract.ano ?? "Não informado"}
                      </td>
                      <td className="px-5 py-4">
                        <SituationBadge value={contract.situacao} />
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge
                          active={contratoEstaAtivo(contract.situacao)}
                        />
                      </td>
                      <td className="px-5 py-4">
                        <AnnualityBadge
                          contract={contract}
                          requestedYear={appliedFilters.anoReferencia}
                        />
                      </td>
                      <td className="px-5 py-4 text-right">
                        <DetailsLink contractId={contract.id} backSearch={listSearch} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="divide-y divide-[#f0ecf2] lg:hidden">
              {result.items.map((contract) => (
                <article
                  key={contract.id}
                  className={`p-5 ${
                    selectedContractIds.includes(contract.id)
                      ? "bg-[#f8f3fa]"
                      : ""
                  }`}
                >
                  {canGenerateAnnualities && (
                    <div className="mb-4">
                      <ContractCheckbox
                        contract={contract}
                        checked={selectedContractIds.includes(contract.id)}
                        onChange={() => toggleContractSelection(contract.id)}
                        showLabel
                      />
                    </div>
                  )}
                  <div className="flex items-start justify-between gap-3">
                    <ContractIdentity contract={contract} />
                    <StatusBadge
                      active={contratoEstaAtivo(contract.situacao)}
                    />
                  </div>
                  <div className="mt-4">
                    <ContractHolder holder={contract.titular} mobile />
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <Information
                      label="Ano"
                      value={contract.ano ?? "Não informado"}
                    />
                    <Information
                      label="Situação"
                      value={contract.situacao || "Não informada"}
                    />
                    <Information
                      label="Anuidade"
                      value={getAnnualityLabel(
                        contract,
                        appliedFilters.anoReferencia,
                      )}
                    />
                  </div>
                  <DetailsLink contractId={contract.id} mobile backSearch={listSearch} />
                </article>
              ))}
            </div>
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
              itemLabelSingular="contrato encontrado"
              itemLabelPlural="contratos encontrados"
            />
          </>
        )}
      </section>

      <Modal
        open={showGenerateModal}
        onClose={closeGenerateModal}
        title="Gerar anuidades selecionadas"
        description={`Confirme a geração para ${selectedContractIds.length} ${
          selectedContractIds.length === 1 ? "contrato" : "contratos"
        } desta página.`}
        maxWidth="max-w-lg"
      >
        <div className="space-y-5 px-5 py-6 sm:px-6">
          <div className="flex items-start gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
            <AlertTriangle size={22} className="mt-0.5 shrink-0" />
            <p className="text-sm leading-6 text-amber-800">
              Somente os códigos abaixo serão enviados. Contratos que não
              satisfizerem as regras da cobrança serão informados no resultado
              sem interromper os demais.
            </p>
          </div>

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-[#988e9c]">
              Contratos desta página
            </p>
            <ul className="max-h-64 space-y-2 overflow-y-auto rounded-2xl border border-[#e7e1e9] p-3">
              {selectedContracts.map((contract) => (
                <li
                  key={contract.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-[#faf8fb] px-3 py-2.5"
                >
                  <span className="text-sm font-bold text-[#3b303f]">
                    {getContractNumber(contract)}
                  </span>
                  <span className="text-xs font-semibold text-[#8b818f]">
                    Código {contract.id}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {generateError && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700"
            >
              <XCircle size={19} className="mt-0.5 shrink-0" />
              <p className="text-sm leading-6">{generateError}</p>
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-[#eee9f0] bg-[#fcfafc] px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button
            type="button"
            onClick={closeGenerateModal}
            disabled={isGenerating}
            className="h-11 rounded-xl border border-[#dad3dd] px-5 text-sm font-bold text-[#675d6b] transition hover:border-[#bfaec6] hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Voltar
          </button>
          <button
            type="button"
            onClick={handleGenerateAnnualities}
            disabled={isGenerating || selectedContractIds.length === 0}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#432059] px-5 text-sm font-bold text-white transition hover:bg-[#341366] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isGenerating ? (
              <>
                <LoaderCircle size={18} className="animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <CalendarPlus size={17} />
                Confirmar geração
              </>
            )}
          </button>
        </div>
      </Modal>
    </div>
  );
}

function ContractCheckbox({ contract, checked, onChange, showLabel = false }) {
  const disabled = contract.possuiAnuidade;
  const label = disabled
    ? `${getContractNumber(contract)} já possui anuidade`
    : `Selecionar contrato ${getContractNumber(contract)}`;

  return (
    <label
      className={`inline-flex items-center gap-2 text-sm font-semibold ${
        disabled
          ? "cursor-not-allowed text-[#aaa1ae]"
          : "cursor-pointer text-[#5d276d]"
      }`}
      title={disabled ? "Este contrato já possui anuidade" : undefined}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        aria-label={label}
        className="h-4 w-4 rounded border-[#ded8e2] accent-[#432059] disabled:cursor-not-allowed disabled:opacity-40"
      />
      {showLabel && (
        <span>{disabled ? "Já possui anuidade" : "Selecionar contrato"}</span>
      )}
    </label>
  );
}

function GenerationResult({ result, onClose }) {
  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-emerald-800"
    >
      <CheckCircle2 size={20} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">Geração concluída</p>
        <p className="mt-1 text-sm leading-6">
          {result.geradas} de {result.totalContratos} contratos receberam uma
          nova anuidade.
        </p>
        {result.contratosComErro.length > 0 && (
          <GenerationIssues
            title="Contratos com erro"
            items={result.contratosComErro}
            color="amber"
          />
        )}
        {result.contratosJaExistentes.length > 0 && (
          <GenerationIssues
            title="Contratos que já possuíam anuidade"
            items={result.contratosJaExistentes}
            color="blue"
          />
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="shrink-0 rounded-lg p-1 transition hover:bg-emerald-100"
        aria-label="Fechar resultado"
      >
        <XCircle size={18} />
      </button>
    </div>
  );
}

function GenerationIssues({ title, items, color }) {
  const colorClasses =
    color === "blue"
      ? "border-blue-200 bg-blue-50 text-blue-900"
      : "border-amber-200 bg-amber-50 text-amber-900";

  return (
    <div className={`mt-3 rounded-xl border p-3 ${colorClasses}`}>
      <p className="text-xs font-bold uppercase tracking-[0.1em]">{title}</p>
      <ul className="mt-2 space-y-1.5">
        {items.map((item) => (
          <li key={item.contratoId} className="text-sm leading-5">
            <span className="font-bold">
              {[item.numero, item.letra].filter(Boolean).join("/") ||
                `Contrato ${item.contratoId}`}
            </span>
            {(item.motivo || item.mensagem) && (
              <span> — {item.motivo || item.mensagem}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function DetailsLink({ contractId, mobile = false, backSearch = "" }) {
  return (
    <Link
      to={`/contratos/${contractId}`}
      // Leva a busca atual junto, pro "Voltar" da tela de detalhes
      // devolver a listagem como estava.
      state={{ listSearch: backSearch }}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#ddd5e0] px-4 text-xs font-bold text-[#5d276d] transition hover:border-[#432059] hover:bg-[#f8f4fa] ${
        mobile ? "mt-4 w-full" : ""
      }`}
    >
      <Eye size={16} />
      Detalhes
    </Link>
  );
}

function FilterField({ icon: Icon, children }) {
  return (
    <div className="flex h-12 items-center rounded-xl border border-[#ded8e2] bg-white text-[#8b818f] transition focus-within:border-[#432059] focus-within:ring-4 focus-within:ring-[#432059]/10">
      <Icon size={18} className="ml-4 shrink-0" />
      {children}
    </div>
  );
}

function StatisticCard({ label, value, icon: Icon, iconClassName }) {
  return (
    <article className="rounded-2xl border border-[#e7e1e9] bg-white p-5 shadow-[0_8px_30px_rgba(56,32,65,0.04)]">
      <div className="flex items-center justify-between gap-4">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl ${iconClassName}`}
        >
          <Icon size={21} />
        </div>
        <p className="text-3xl font-bold tracking-[-0.04em] text-[#302733]">
          {value}
        </p>
      </div>
      <p className="mt-4 text-sm font-semibold text-[#817688]">{label}</p>
    </article>
  );
}

function TableHeading({ children, align = "left" }) {
  return (
    <th
      className={`px-5 py-3.5 text-[11px] font-bold uppercase tracking-[0.13em] text-[#8d8391] ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function ContractIdentity({ contract }) {
  const completeNumber = getContractNumber(contract);
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ede4f1] text-[#5d276d]">
        <FileText size={19} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-[#342b37]">
          {completeNumber}
        </p>
        <p className="mt-1 truncate text-xs text-[#928895]">
          Código interno {contract.id}
        </p>
      </div>
    </div>
  );
}

function getContractNumber(contract) {
  return (
    [contract.numero, contract.letra].filter(Boolean).join(" / ") ||
    "Contrato sem número"
  );
}

function ContractHolder({ holder, mobile = false }) {
  if (!holder) {
    return (
      <div
        className={
          mobile
            ? "rounded-xl border border-amber-200 bg-amber-50 p-3"
            : "min-w-[190px]"
        }
      >
        {mobile && (
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-amber-700">
            Titular
          </p>
        )}
        <p className={`${mobile ? "mt-1.5" : ""} text-sm font-semibold text-amber-700`}>
          Titular não informado
        </p>
        <p className="mt-1 text-xs text-amber-700/75">
          Sem vínculo cadastrado
        </p>
      </div>
    );
  }

  return (
    <div
      className={`flex min-w-0 items-center gap-3 ${
        mobile ? "rounded-xl bg-[#faf8fb] p-3" : "min-w-[210px]"
      }`}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
        <UserRound size={17} />
      </div>
      <div className="min-w-0">
        {mobile && (
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#988e9c]">
            Titular
          </p>
        )}
        <p className={`${mobile ? "mt-1" : ""} truncate text-sm font-bold text-[#342b37]`}>
          {holder.nome || "Nome não informado"}
        </p>
        <p className="mt-1 truncate text-xs text-[#928895]">
          {holder.documento || "Documento não informado"}
        </p>
      </div>
    </div>
  );
}

function SituationBadge({ value }) {
  return (
    <span className="inline-flex rounded-full border border-[#ded4e2] bg-[#f7f3f8] px-2.5 py-1 text-xs font-bold text-[#684974]">
      {value || "Não informada"}
    </span>
  );
}

function StatusBadge({ active }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-bold ${
        active
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-slate-50 text-slate-600"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          active ? "bg-emerald-500" : "bg-slate-400"
        }`}
      />
      {active ? "Ativo" : "Inativo"}
    </span>
  );
}

function getAnnualityLabel(contract, requestedYear) {
  if (requestedYear) {
    return contract.possuiAnuidade
      ? `Possui em ${requestedYear}`
      : `Não possui em ${requestedYear}`;
  }
  return contract.possuiAnuidade ? "Possui anuidade" : "Sem anuidade";
}

function AnnualityBadge({ contract, requestedYear }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-bold ${
        contract.possuiAnuidade
          ? "border-blue-200 bg-blue-50 text-blue-700"
          : "border-amber-200 bg-amber-50 text-amber-700"
      }`}
    >
      {contract.possuiAnuidade ? (
        <CheckCircle2 size={13} />
      ) : (
        <XCircle size={13} />
      )}
      {getAnnualityLabel(contract, requestedYear)}
    </span>
  );
}

function Information({ label, value }) {
  return (
    <div className="rounded-xl bg-[#faf8fb] p-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#988e9c]">
        {label}
      </p>
      <p className="mt-1.5 text-xs font-semibold text-[#554b59]">{value}</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-3 p-5" aria-label="Carregando contratos">
      {[1, 2, 3, 4].map((item) => (
        <div
          key={item}
          className="h-16 animate-pulse rounded-2xl bg-[#f3eff4]"
        />
      ))}
    </div>
  );
}

function EmptyState({ hasFilters, onClear }) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center px-5 py-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f0e8f3] text-[#432059]">
        <FileSearch size={28} />
      </div>
      <h3 className="mt-5 text-lg font-bold text-[#342b37]">
        Nenhum contrato encontrado
      </h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-[#817688]">
        {hasFilters
          ? "Revise os filtros utilizados ou faça uma nova pesquisa."
          : "A API ainda não retornou contratos para esta consulta."}
      </p>
      {hasFilters && (
        <button
          type="button"
          onClick={onClear}
          className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl border border-[#dcd4df] px-4 text-sm font-bold text-[#432059] transition hover:border-[#432059] hover:bg-[#f8f4fa]"
        >
          <FilterX size={18} />
          Limpar filtros
        </button>
      )}
    </div>
  );
}
