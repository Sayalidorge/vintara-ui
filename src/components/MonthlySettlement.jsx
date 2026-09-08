import React, { useEffect, useState } from "react";
import Select from "react-select";
import config from "../config";
import "./MonthlySettlement.css";
import { downloadCsv } from "../utils/csv";
import { isSuperAdmin } from "../utils/auth";
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

        if (!selectedResort) {
            alert("Please select a resort.");
            return;
        }

        setLoading(true);

        try {

            const response = await fetch(

                `${config.BASE_URL}/api/settlement/generate?resortId=${selectedResort.value}&month=${selectedMonth}&year=${selectedYear}`,

                {
                    method: "POST",
                    headers: config.getHeaders()
                }

            );

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

    const exportSettlement = () => {
        if (!settlement) return;

        // Marketing models leave the food/property fields null (see the
        // strategy classes) rather than always emitting every field, so
        // filter those out instead of hardcoding a field list per model.
        const rows = [
            { field: "Resort Turnover", value: settlement.resortTurnover },
            { field: "Vintara Collection", value: settlement.vintaraCollection },
            { field: "Property Collection", value: settlement.propertyCollection },
            { field: "GST Amount", value: settlement.gstAmount },
            { field: "OTA Commission", value: settlement.otaCommission },
            { field: "OTA Turnover", value: settlement.otaTurnover },
            { field: "OTA GST", value: settlement.otaGST },
            { field: "Marketing Commission", value: settlement.marketingCommission },
            { field: "Marketing Commission (OTA)", value: settlement.marketingCommissionOTA },
            { field: "Marketing Commission (Vintara)", value: settlement.marketingCommissionVintara },
            { field: "Total Marketing Commission", value: settlement.totalMarketingCommission },
            { field: "Property Expense", value: settlement.propertyExpense },
            { field: "Vintara Expense", value: settlement.vintaraExpense },
            { field: "Total Vintara Expense", value: settlement.totalVintaraExpense },
            { field: "Food Collection", value: settlement.foodCollection },
            { field: "Food Expense", value: settlement.foodExpense },
            { field: "Vintara Food Commission", value: settlement.vintaraFoodCommission },
            { field: "Food Profit / Loss", value: settlement.foodProfitLoss },
            { field: "Profit Remaining With Vintara", value: settlement.vintaraProfitLoss },
            { field: "Profit Remaining With Property", value: settlement.propertyProfitLoss },
            { field: "Total Profit / Loss", value: settlement.totalProfitLoss },
            { field: "Owner Settlement Amount", value: settlement.ownerSettlementAmount },
        ].filter((row) => row.value !== null && row.value !== undefined);

        downloadCsv(
            `settlement_${settlement.resort?.name || "resort"}_${settlement.month}-${settlement.year}.csv`,
            rows,
            [
                { key: "field", header: "Field" },
                { key: "value", header: "Value" },
            ]
        );
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

                <button className="btn btn-teal" onClick={generateSettlement}>
                    Generate Settlement
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
                                    {monthOptions.find(m => m.value === settlement.month)?.label} {settlement.year}
                                </span>
                                <span className="pill pill-model">
                                    {COMMISSION_MODEL_LABELS[settlement.commissionModel] || settlement.commissionModel}
                                    {settlement.commissionPercentage !== null && settlement.commissionPercentage !== undefined
                                        ? ` · ${settlement.commissionPercentage}%`
                                        : ""}
                                </span>
                                <span className={`pill ${settlement.status === "APPROVED" ? "pill-finalized" : "pill-draft"}`}>
                                    {settlement.status === "APPROVED" ? "Finalized" : "Draft"}
                                </span>
                            </div>
                        </div>
                        <div className="result-actions">
                            {isSuperAdmin() && (
                                <button type="button" className="btn btn-outline" onClick={exportSettlement}>
                                    Export CSV
                                </button>
                            )}
                            <button
                                className="btn btn-teal"
                                onClick={handleFinalize}
                                disabled={finalizing || settlement.status === "APPROVED"}
                            >
                                {settlement.status === "APPROVED" ? "Finalized" : finalizing ? "Finalizing…" : "Finalize"}
                            </button>
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
