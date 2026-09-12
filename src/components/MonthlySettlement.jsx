import React, { useEffect, useState } from "react";
import Select from "react-select";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import config from "../config";
import "./MonthlySettlement.css";
import { downloadBlob } from "../utils/csv";
import { isSuperAdmin } from "../utils/auth";
import { toLocalDateStr, formatDateDMY } from "../utils/date";
import { menuPortalTarget, menuPosition, themedSelectStyles } from "../utils/reactSelectTheme";

// Same human labels as the dropdown on Manage Resorts (ManageResorts.jsx),
// duplicated here rather than shared since it's a tiny fixed lookup tied to
// the CommissionModel enum, not something that changes independently.
const COMMISSION_MODEL_LABELS = {
    GROWTH_RENTED: "Growth Model - Rented",
    GROWTH_REVENUE: "Growth Model - Revenue",
    GROWTH_MARKETING: "Growth Model - Marketing",
    STANDARD_RENTED: "Standard Commission Model - Rented",
    STANDARD_MARKETING: "Standard Commission Model - Marketing",
};

const money = (n) => (n === null || n === undefined ? "-" : `₹${Number(n).toLocaleString()}`);
const signedMoney = (n) =>
    n === null || n === undefined ? "-" : `${Number(n) >= 0 ? "+" : "−"}₹${Math.abs(Number(n)).toLocaleString()}`;
const isPositive = (n) => n !== null && n !== undefined && Number(n) >= 0;
const plOrLossColor = (n) => (isPositive(n) ? "var(--profit)" : "var(--loss)");

const MonthlySettlement = () => {

    const [resorts, setResorts] = useState([]);
    const [selectedResort, setSelectedResort] = useState(null);
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    // "range" is a live, view-only computation for checking progress mid-
    // period - see generateSettlement below. Nothing in range mode is ever
    // saved (GET /api/settlement/preview, not POST /generate), so the
    // result never has an id - Finalize/Export PDF are hidden for it.
    const [periodMode, setPeriodMode] = useState("month");
    const [rangeFrom, setRangeFrom] = useState(null);
    const [rangeTo, setRangeTo] = useState(null);
    const [settlement, setSettlement] = useState(null);
    const [loading, setLoading] = useState(false);
    const [finalizing, setFinalizing] = useState(false);

    useEffect(() => {

        fetch(`${config.BASE_URL}/api/resorts`, {
            headers: config.getHeaders()
        })
            .then(res => res.json())
            .then(data => {

                const options = data.map(r => ({
                    value: r.id,
                    label: r.name
                }));

                setResorts(options);

            });

    }, []);

    const monthOptions = [
        { value: 1, label: "January" },
        { value: 2, label: "February" },
        { value: 3, label: "March" },
        { value: 4, label: "April" },
        { value: 5, label: "May" },
        { value: 6, label: "June" },
        { value: 7, label: "July" },
        { value: 8, label: "August" },
        { value: 9, label: "September" },
        { value: 10, label: "October" },
        { value: 11, label: "November" },
        { value: 12, label: "December" }
    ];

    const generateSettlement = async () => {
        if (loading) return;

        if (!selectedResort) {
            alert("Please select a resort.");
            return;
        }

        let url;
        if (periodMode === "range") {
            if (!rangeFrom || !rangeTo) {
                alert("Please pick both a From and To date.");
                return;
            }
            if (rangeFrom > rangeTo) {
                alert("From date must be before To date.");
                return;
            }
            url = `${config.BASE_URL}/api/settlement/preview?resortId=${selectedResort.value}&startDate=${toLocalDateStr(rangeFrom)}&endDate=${toLocalDateStr(rangeTo)}`;
        } else {
            url = `${config.BASE_URL}/api/settlement/generate?resortId=${selectedResort.value}&month=${selectedMonth}&year=${selectedYear}`;
        }

        setLoading(true);

        try {

            const response = await fetch(url, {
                method: periodMode === "range" ? "GET" : "POST",
                headers: config.getHeaders()
            });

            if (!response.ok) {
                throw new Error("Unable to generate settlement");
            }

            const data = await response.json();

            setSettlement(data);

        }
        catch (e) {
            alert(e.message);
        }

        setLoading(false);

    };

    const handleFinalize = async () => {
        if (!settlement) return;
        if (!window.confirm("Finalize this settlement? This marks it as approved.")) return;

        setFinalizing(true);
        try {
            const response = await fetch(
                `${config.BASE_URL}/api/settlement/${settlement.id}/finalize`,
                { method: "POST", headers: config.getHeaders() }
            );
            if (!response.ok) {
                const errBody = await response.json().catch(() => null);
                throw new Error(errBody?.error || "Unable to finalize settlement");
            }
            const data = await response.json();
            setSettlement(data);
        } catch (e) {
            alert(e.message);
        }
        setFinalizing(false);
    };

    const isMarketingModel = settlement
        ? ["GROWTH_MARKETING", "STANDARD_MARKETING"].includes(settlement.commissionModel)
        : false;

    // Whether marketing commission is a single flat figure (Growth models)
    // or a 3-part OTA/Vintara/Total breakdown (Standard models) - the
    // calculator only ever populates one shape, never both.
    const hasFlatMarketingCommission = !!settlement
        && settlement.marketingCommission !== null
        && settlement.marketingCommission !== undefined;

    // Only GrowthRevenueStrategy populates this - a flat 10% of food
    // collection, hardcoded in the strategy (not the resort's configurable
    // commissionPercentage).
    const hasFoodCommission = !!settlement
        && settlement.vintaraFoodCommission !== null
        && settlement.vintaraFoodCommission !== undefined;

    // Built from which fields are actually present rather than hardcoded per
    // model, so it can't drift from SettlementCalculator's real composition:
    // Marketing models omit the Vintara Expense term (see
    // GrowthMarketingStrategy/StandardMarketingStrategy.calculate).
    const totalVintaraExpenseFormula = () => {
        const terms = [];
        if (!isMarketingModel) terms.push("Vintara Expense");
        terms.push(hasFlatMarketingCommission ? "Marketing Commission" : "Total Marketing Commission");
        terms.push("OTA Commission", "GST Amount");
        if (hasFoodCommission) terms.push("Vintara Food Commission");
        return terms.join(" + ");
    };

    // A range preview (see generateSettlement) has no month/year - only
    // startDate/endDate - so every place that displays/exports "which
    // period is this" branches through these two helpers instead of
    // assuming settlement.month is always set.
    const settlementPeriodLabel = () => {
        if (!settlement) return "";
        if (settlement.month) {
            const monthLabel = monthOptions.find(m => m.value === settlement.month)?.label || settlement.month;
            return `${monthLabel} ${settlement.year}`;
        }
        return `${formatDateDMY(settlement.startDate)} - ${formatDateDMY(settlement.endDate)}`;
    };

    const settlementPeriodSlug = () =>
        settlement.month
            ? `${settlement.month}-${settlement.year}`
            : `${settlement.startDate}_to_${settlement.endDate}`;

    const settlementFilenameBase = () =>
        `settlement_${(settlement.resort?.name || "resort").replace(/[^a-zA-Z0-9]+/g, "_")}_${settlementPeriodSlug()}`;

    // Client-side, like the old CSV export - settlement is already fully
    // loaded, no backend round-trip needed for a plain text summary.
    // Organized into the same sections as the page/PDF (Collection,
    // Marketing Commission, Expenses, Food Account, Profit/Loss Summary)
    // rather than one flat field list.
    const exportSettlementText = () => {
        if (!settlement) return;

        const row = (label, value) => (value !== null && value !== undefined ? `${label}: ${money(value)}` : null);

        const sections = [
            {
                title: "Collection",
                rows: [
                    row("Resort Turnover", settlement.resortTurnover),
                    row("Vintara Collection", settlement.vintaraCollection),
                    row("Property Collection", settlement.propertyCollection),
                    row("OTA Turnover", settlement.otaTurnover),
                    row("OTA GST", settlement.otaGST),
                ],
            },
            {
                title: "Marketing Commission",
                rows: hasFlatMarketingCommission
                    ? [
                        row("GST Amount", settlement.gstAmount),
                        row("OTA Commission", settlement.otaCommission),
                        row("Marketing Commission", settlement.marketingCommission),
                    ]
                    : [
                        row("GST Amount", settlement.gstAmount),
                        row("OTA Commission", settlement.otaCommission),
                        row("Marketing Commission (OTA)", settlement.marketingCommissionOTA),
                        row("Marketing Commission (Vintara)", settlement.marketingCommissionVintara),
                        row("Total Marketing Commission", settlement.totalMarketingCommission),
                    ],
            },
            {
                title: isMarketingModel ? "Total Vintara Expense" : "Expenses",
                rows: isMarketingModel
                    ? [row("Total Vintara Expense", settlement.totalVintaraExpense)]
                    : [
                        row("Property Expense", settlement.propertyExpense),
                        row("Vintara Expense", settlement.vintaraExpense),
                        row("Total Vintara Expense", settlement.totalVintaraExpense),
                    ],
            },
            !isMarketingModel && {
                title: "Food Account",
                rows: [
                    row("Food Collection", settlement.foodCollection),
                    row("Food Expense", settlement.foodExpense),
                    hasFoodCommission ? row("Vintara Food Commission", settlement.vintaraFoodCommission) : null,
                    row("Food Profit / Loss", settlement.foodProfitLoss),
                ],
            },
            !isMarketingModel
                ? {
                    title: "Profit / Loss Summary",
                    rows: [
                        row("Profit Remaining With Vintara", settlement.vintaraProfitLoss),
                        row("Profit Remaining With Property", settlement.propertyProfitLoss),
                        row("Total Profit / Loss", settlement.totalProfitLoss),
                    ],
                }
                : {
                    title: "Owner Settlement",
                    rows: [row("Owner Settlement Amount", settlement.ownerSettlementAmount)],
                },
        ].filter(Boolean);

        const lines = [
            settlement.month ? "VINTARA STAYS - MONTHLY SETTLEMENT" : "VINTARA STAYS - SETTLEMENT (CUSTOM RANGE PREVIEW)",
            `${settlement.resort?.name || "-"} | ${settlementPeriodLabel()}`,
            `${COMMISSION_MODEL_LABELS[settlement.commissionModel] || settlement.commissionModel}${
                settlement.commissionPercentage !== null && settlement.commissionPercentage !== undefined
                    ? ` - ${settlement.commissionPercentage}%`
                    : ""
            }`,
        ];
        sections.forEach((section) => {
            const rows = section.rows.filter(Boolean);
            if (rows.length === 0) return;
            lines.push("", `== ${section.title.toUpperCase()} ==`, ...rows);
        });

        const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8;" });
        downloadBlob(blob, `${settlementFilenameBase()}.txt`);
    };

    // Server-rendered, since it needs to visually match the page's sections/
    // colors/formula captions, not just a field list - see SettlementPdfService.
    const exportSettlementPdf = async () => {
        if (!settlement) return;
        try {
            const response = await fetch(`${config.BASE_URL}/api/settlement/${settlement.id}/pdf`, {
                headers: config.getHeaders(),
            });
            if (!response.ok) {
                throw new Error("Unable to generate settlement PDF");
            }
            const blob = await response.blob();
            downloadBlob(blob, `${settlementFilenameBase()}.pdf`);
        } catch (e) {
            alert(e.message);
        }
    };

    return (

        <div className="monthly-settlement-page">

            <h2 className="page-title">Monthly Settlement</h2>

            <div className="settlement-filters">

                <div className="filter-item">
                    <label>Resort</label>
                    <Select
                        classNamePrefix="react-select"
                        options={resorts}
                        value={selectedResort}
                        onChange={setSelectedResort}
                        placeholder="Select resort..."
                        menuPortalTarget={menuPortalTarget}
                        menuPosition={menuPosition}
                        styles={themedSelectStyles()}
                    />
                </div>

                <div className="filter-item">
                    <label style={{ visibility: "hidden" }}>Mode</label>
                    <div className="period-mode-toggle">
                        <button
                            type="button"
                            className={`btn ${periodMode === "month" ? "btn-teal" : "btn-outline"}`}
                            onClick={() => setPeriodMode("month")}
                        >
                            Full Month
                        </button>
                        <button
                            type="button"
                            className={`btn ${periodMode === "range" ? "btn-teal" : "btn-outline"}`}
                            onClick={() => setPeriodMode("range")}
                        >
                            Custom Range
                        </button>
                    </div>
                </div>

                {periodMode === "month" ? (
                    <>
                        <div className="filter-item">
                            <label>Month</label>
                            <Select
                                options={monthOptions}
                                value={monthOptions.find(m => m.value === selectedMonth)}
                                onChange={(obj) => setSelectedMonth(obj.value)}
                                menuPortalTarget={menuPortalTarget}
                                menuPosition={menuPosition}
                                styles={themedSelectStyles()}
                            />
                        </div>

                        <div className="filter-item filter-item--narrow">
                            <label>Year</label>
                            <input
                                type="number"
                                className="year-input"
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(e.target.value)}
                            />
                        </div>
                    </>
                ) : (
                    <>
                        <div className="filter-item">
                            <label>From Date</label>
                            <DatePicker
                                selected={rangeFrom}
                                onChange={setRangeFrom}
                                dateFormat="dd-MM-yyyy"
                                className="date-picker"
                                portalId="datepicker-portal"
                            />
                        </div>

                        <div className="filter-item">
                            <label>To Date</label>
                            <DatePicker
                                selected={rangeTo}
                                onChange={setRangeTo}
                                dateFormat="dd-MM-yyyy"
                                className="date-picker"
                                portalId="datepicker-portal"
                            />
                        </div>
                    </>
                )}

                <button className="btn btn-teal" onClick={generateSettlement} disabled={loading}>
                    {loading ? "Generating..." : periodMode === "range" ? "Preview Settlement" : "Generate Settlement"}
                </button>

            </div>

            {loading && (
                <div className="loading-banner">Generating settlement…</div>
            )}

            {settlement && (

                <div className="settlement-result">

                    <div className="result-header">
                        <div className="result-titles">
                            <h3>{settlement.resort?.name}</h3>
                            <div className="result-period">
                                <span>
                                    {settlementPeriodLabel()}
                                </span>
                                <span className="pill pill-model">
                                    {COMMISSION_MODEL_LABELS[settlement.commissionModel] || settlement.commissionModel}
                                    {settlement.commissionPercentage !== null && settlement.commissionPercentage !== undefined
                                        ? ` · ${settlement.commissionPercentage}%`
                                        : ""}
                                </span>
                                <span className={`pill ${!settlement.id ? "pill-preview" : settlement.status === "APPROVED" ? "pill-finalized" : "pill-draft"}`}>
                                    {!settlement.id ? "Preview" : settlement.status === "APPROVED" ? "Finalized" : "Draft"}
                                </span>
                            </div>
                        </div>
                        <div className="result-actions">
                            {isSuperAdmin() && (
                                <>
                                    <button type="button" className="btn btn-outline" onClick={exportSettlementText}>
                                        Export Text
                                    </button>
                                    {settlement.id && (
                                        <button type="button" className="btn btn-outline" onClick={exportSettlementPdf}>
                                            Export PDF
                                        </button>
                                    )}
                                </>
                            )}
                            {settlement.id && (
                                <button
                                    className="btn btn-teal"
                                    onClick={handleFinalize}
                                    disabled={finalizing || settlement.status === "APPROVED"}
                                >
                                    {settlement.status === "APPROVED" ? "Finalized" : finalizing ? "Finalizing…" : "Finalize"}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* COLLECTION - input */}
                    <div className="section">
                        <div className="section-header input">
                            <span>Collection</span><span className="kind">Input</span>
                        </div>
                        <div className="section-body">
                            <div className="tile-row">
                                <div className="tile">
                                    <div className="tile-label">Resort Turnover</div>
                                    <div className="tile-value">{money(settlement.resortTurnover)}</div>
                                </div>
                                <div className="tile">
                                    <div className="tile-label">Vintara Collection</div>
                                    <div className="tile-value">{money(settlement.vintaraCollection)}</div>
                                </div>
                                <div className="tile">
                                    <div className="tile-label">Property Collection</div>
                                    <div className="tile-value">{money(settlement.propertyCollection)}</div>
                                </div>
                            </div>
                            <div className="secondary-chips">
                                <div className="chip">OTA Turnover <b>{money(settlement.otaTurnover)}</b></div>
                                <div className="chip">OTA GST <b>{money(settlement.otaGST)}</b></div>
                            </div>
                        </div>
                    </div>

                    {/* MARKETING COMMISSION - calculated */}
                    <div className="section">
                        <div className="section-header calc">
                            <span>Marketing Commission</span><span className="kind">Calculated</span>
                        </div>
                        <div className="section-body">
                            <div className="line-row">
                                <span>GST Amount</span>
                                <span className="value">{money(settlement.gstAmount)}</span>
                            </div>
                            <div className="line-row">
                                <span>OTA Commission</span>
                                <span className="value">{money(settlement.otaCommission)}</span>
                            </div>

                            {hasFlatMarketingCommission ? (
                                <div className="line-row subtotal">
                                    <span>
                                        Marketing Commission
                                        <span className="formula">
                                            (Resort Turnover − GST − OTA Commission) × {settlement.commissionPercentage}%
                                        </span>
                                    </span>
                                    <span className="value">{money(settlement.marketingCommission)}</span>
                                </div>
                            ) : (
                                <>
                                    <div className="line-row">
                                        <span>
                                            Marketing Commission (OTA)
                                            <span className="formula">OTA Turnover − OTA GST − OTA Commission</span>
                                        </span>
                                        <span className="value">{money(settlement.marketingCommissionOTA)}</span>
                                    </div>
                                    <div className="line-row">
                                        <span>
                                            Marketing Commission (Vintara)
                                            <span className="formula">Resort Turnover − OTA Turnover − (GST − OTA GST)</span>
                                        </span>
                                        <span className="value">{money(settlement.marketingCommissionVintara)}</span>
                                    </div>
                                    <div className="line-row subtotal">
                                        <span>
                                            Total Marketing Commission
                                            <span className="formula">Marketing Commission (OTA) + Marketing Commission (Vintara)</span>
                                        </span>
                                        <span className="value">{money(settlement.totalMarketingCommission)}</span>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* EXPENSES - input, Rented/Revenue models only */}
                    {!isMarketingModel && (
                        <div className="section">
                            <div className="section-header input">
                                <span>Expenses</span><span className="kind">Input</span>
                            </div>
                            <div className="section-body">
                                <div className="line-row">
                                    <span>Property Expense</span>
                                    <span className="value">{money(settlement.propertyExpense)}</span>
                                </div>
                                <div className="line-row">
                                    <span>Vintara Expense</span>
                                    <span className="value">{money(settlement.vintaraExpense)}</span>
                                </div>
                                <div className="line-row subtotal">
                                    <span>
                                        Total Vintara Expense
                                        <span className="formula">{totalVintaraExpenseFormula()}</span>
                                    </span>
                                    <span className="value">{money(settlement.totalVintaraExpense)}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Marketing models have no separate Expenses section (no
                        property/vintara expense split), but still surface
                        Total Vintara Expense since it feeds Owner Settlement. */}
                    {isMarketingModel && (
                        <div className="section">
                            <div className="section-header calc">
                                <span>Total Vintara Expense</span><span className="kind">Calculated</span>
                            </div>
                            <div className="section-body">
                                <div className="line-row subtotal">
                                    <span>
                                        Total Vintara Expense
                                        <span className="formula">{totalVintaraExpenseFormula()}</span>
                                    </span>
                                    <span className="value">{money(settlement.totalVintaraExpense)}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* FOOD ACCOUNT + 3-way bottom line - Rented/Revenue models only */}
                    {!isMarketingModel && (
                        <>
                            <div className="section">
                                <div className="section-header input">
                                    <span>Food Account</span><span className="kind">Input</span>
                                </div>
                                <div className="section-body">
                                    <div className="line-row">
                                        <span>Food Collection</span>
                                        <span className="value">{money(settlement.foodCollection)}</span>
                                    </div>
                                    <div className="line-row">
                                        <span>Food Expense</span>
                                        <span className="value">{money(settlement.foodExpense)}</span>
                                    </div>
                                    {hasFoodCommission && (
                                        <div className="line-row">
                                            <span>
                                                Vintara Food Commission
                                                <span className="formula">Food Collection × 10%</span>
                                            </span>
                                            <span className="value">{money(settlement.vintaraFoodCommission)}</span>
                                        </div>
                                    )}
                                    <div className="line-row subtotal">
                                        <span>
                                            Food Profit / Loss
                                            <span className="formula">
                                                Food Collection − Food Expense{hasFoodCommission ? " − Vintara Food Commission" : ""}
                                            </span>
                                        </span>
                                        <span className="value" style={{ color: plOrLossColor(settlement.foodProfitLoss) }}>
                                            {signedMoney(settlement.foodProfitLoss)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="bottom-line">
                                <div className="breakdown">
                                    <div>
                                        Vintara Profit
                                        <b style={{ color: plOrLossColor(settlement.vintaraProfitLoss) }}>
                                            {signedMoney(settlement.vintaraProfitLoss)}
                                        </b>
                                    </div>
                                    <div>
                                        Property Profit
                                        <b style={{ color: plOrLossColor(settlement.propertyProfitLoss) }}>
                                            {signedMoney(settlement.propertyProfitLoss)}
                                        </b>
                                    </div>
                                    <div>
                                        Food Profit
                                        <b style={{ color: plOrLossColor(settlement.foodProfitLoss) }}>
                                            {signedMoney(settlement.foodProfitLoss)}
                                        </b>
                                    </div>
                                </div>
                                <div className="headline">
                                    <div className="label">Total Profit / Loss</div>
                                    <div className="amount" style={{ color: plOrLossColor(settlement.totalProfitLoss) }}>
                                        {signedMoney(settlement.totalProfitLoss)}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {/* OWNER SETTLEMENT - Marketing models only */}
                    {isMarketingModel && settlement.ownerSettlementAmount !== null && settlement.ownerSettlementAmount !== undefined && (
                        <div className="bottom-line owner-settlement">
                            <div className="headline" style={{ textAlign: "left" }}>
                                <div className="label">
                                    {settlement.ownerSettlementAmount >= 0 ? "Vintara Owes The Owner" : "Owner Owes Vintara"}
                                </div>
                                <div className="amount" style={{ color: settlement.ownerSettlementAmount >= 0 ? "var(--profit)" : "var(--loss)" }}>
                                    {money(Math.abs(settlement.ownerSettlementAmount))}
                                </div>
                            </div>
                        </div>
                    )}

                </div>

            )}

        </div>

    );

};

export default MonthlySettlement;
