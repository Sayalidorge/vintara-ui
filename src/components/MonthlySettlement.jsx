import React, { useEffect, useState } from "react";
import Select from "react-select";
import config from "../config";
import "./MonthlySettlement.css";
import { downloadCsv } from "../utils/csv";
import { isSuperAdmin } from "../utils/auth";

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

    return (

        <div className="container-fluid mt-4">

            <div className="card shadow-sm">

                <div className="card-header">
                    <h4 className="mb-0" style={{ fontSize: "20px", fontWeight: 700, color: "var(--primary-purple)", textAlign: "left", textTransform: "uppercase", letterSpacing: "1px" }}>Monthly Settlement</h4>
                </div>

                <div className="card-body">

                    <div
                        style={{
                            display: "flex",
                            alignItems: "flex-end",
                            gap: "20px",
                            flexWrap: "wrap",
                            marginBottom: "25px"
                        }}
                    >

                        <div className="settlement-filter-field">
                            <label className="form-label">Resort</label>

<Select
    classNamePrefix="react-select"
    options={resorts}
    value={selectedResort}
    onChange={setSelectedResort}
/>
                        </div>

                        <div className="settlement-filter-field">
                            <label className="form-label">Month</label>

                            <Select
                                options={monthOptions}
                                value={
                                    monthOptions.find(
                                        m => m.value === selectedMonth
                                    )
                                }
                                onChange={(obj) =>
                                    setSelectedMonth(obj.value)
                                }
                            />
                        </div>

                        <div className="settlement-filter-field settlement-filter-field--narrow">
                            <label className="form-label">Year</label>

                            <input
                                type="number"
                                className="form-control"
                                value={selectedYear}
                                onChange={(e) =>
                                    setSelectedYear(e.target.value)
                                }
                            />
                        </div>

                        <div>
                        
                            <button
                                className="btn btn-primary"
                                style={{
                                    minWidth: "180px",
                                    height: "38px"
                                }}
                                onClick={generateSettlement}
                            >
                                Generate Settlement
                            </button>

                        </div>

                    </div>

                    {loading &&
                        <div className="alert alert-info">
                            Generating settlement...
                        </div>
                    }
{settlement && (

<div className="mt-4">

    <div className="card shadow">

        <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">

            <div>

                <h4 className="mb-1">
                    Monthly Settlement
                </h4>

                <small>
                    {settlement.resort?.name} | {settlement.month}/{settlement.year}
                    {settlement.status === "APPROVED" && (
                        <span className="badge bg-light text-success ms-2">Finalized</span>
                    )}
                </small>

            </div>

            <div>

                {isSuperAdmin() && (
                    <button type="button" className="export-csv-btn me-2" onClick={exportSettlement}>
                        Export CSV
                    </button>
                )}

                <button
                    className="btn btn-success btn-sm"
                    onClick={handleFinalize}
                    disabled={finalizing || settlement.status === "APPROVED"}
                >
                    {settlement.status === "APPROVED" ? "Finalized" : finalizing ? "Finalizing…" : "Finalize"}
                </button>

            </div>

        </div>

        <div className="card-body">

            {/* COLLECTION */}

            <div className="card mb-4 border-success">

                <div className="card-header bg-success text-white">
                    Collection Summary
                </div>

                <div className="card-body">

                    <div className="row mb-2">
                        <div className="col-md-8">Resort Turnover</div>
                        <div className="col-md-4 text-end">
                            ₹ {settlement.resortTurnover}
                        </div>
                    </div>

                    <div className="row mb-2">
                        <div className="col-md-8">Vintara Collection</div>
                        <div className="col-md-4 text-end">
                            ₹ {settlement.vintaraCollection}
                        </div>
                    </div>

                    <div className="row">
                        <div className="col-md-8">Property Collection</div>
                        <div className="col-md-4 text-end">
                            ₹ {settlement.propertyCollection}
                        </div>
                    </div>

                </div>

            </div>

            {/* EXPENSES */}

            <div className="card mb-4 border-primary">

                <div className="card-header bg-primary text-white">
                    Expense Summary
                </div>

                <div className="card-body">

                    <div className="row mb-2">
                        <div className="col-md-8">GST Amount</div>
                        <div className="col-md-4 text-end">
                            ₹ {settlement.gstAmount}
                        </div>
                    </div>

                    <div className="row mb-2">
                        <div className="col-md-8">OTA Commission</div>
                        <div className="col-md-4 text-end">
                            ₹ {settlement.otaCommission}
                        </div>
                    </div>

                    {/* Growth models use a flat marketing commission; Standard
                        models derive it from actual OTA figures instead -
                        show whichever the calculator actually populated. */}
                    {settlement.marketingCommission !== null && settlement.marketingCommission !== undefined ? (
                        <div className="row mb-2">
                            <div className="col-md-8">Marketing Commission</div>
                            <div className="col-md-4 text-end">
                                ₹ {settlement.marketingCommission}
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="row mb-2">
                                <div className="col-md-8">Marketing Commission (OTA)</div>
                                <div className="col-md-4 text-end">
                                    ₹ {settlement.marketingCommissionOTA}
                                </div>
                            </div>
                            <div className="row mb-2">
                                <div className="col-md-8">Marketing Commission (Vintara)</div>
                                <div className="col-md-4 text-end">
                                    ₹ {settlement.marketingCommissionVintara}
                                </div>
                            </div>
                            <div className="row mb-2">
                                <div className="col-md-8">Total Marketing Commission</div>
                                <div className="col-md-4 text-end">
                                    ₹ {settlement.totalMarketingCommission}
                                </div>
                            </div>
                        </>
                    )}

                    {!isMarketingModel && (
                    <div className="row mb-2">
                        <div className="col-md-8">Property Expense</div>
                        <div className="col-md-4 text-end">
                            ₹ {settlement.propertyExpense}
                        </div>
                    </div>
                    )}

                    {!isMarketingModel && (
                    <div className="row mb-2">
                        <div className="col-md-8">Vintara Expense</div>
                        <div className="col-md-4 text-end">
                            ₹ {settlement.vintaraExpense}
                        </div>
                    </div>
                    )}

                    <hr/>

                    <div className="row fw-bold">

                        <div className="col-md-8">
                            Total Vintara Expense
                        </div>

                        <div className="col-md-4 text-end">
                            ₹ {settlement.totalVintaraExpense}
                        </div>

                    </div>

                </div>

            </div>

            {/* FOOD + PROFIT/LOSS — Rented/Revenue models only. The two
                Marketing models don't split property/food at all, they
                show a single owed-amount instead (see below). */}
            {!isMarketingModel && (
            <>

            <div className="card mb-4 border-warning">

                <div className="card-header bg-warning">
                    Food Account
                </div>

                <div className="card-body">

                    <div className="row mb-2">

                        <div className="col-md-8">
                            Food Collection
                        </div>

                        <div className="col-md-4 text-end">
                            ₹ {settlement.foodCollection}
                        </div>

                    </div>

                    <div className="row mb-2">

                        <div className="col-md-8">
                            Food Expense
                        </div>

                        <div className="col-md-4 text-end">
                            ₹ {settlement.foodExpense}
                        </div>

                    </div>

                    {settlement.vintaraFoodCommission !== null && settlement.vintaraFoodCommission !== undefined && (
                    <div className="row mb-2">

                        <div className="col-md-8">
                            Vintara Food Commission
                        </div>

                        <div className="col-md-4 text-end">
                            ₹ {settlement.vintaraFoodCommission}
                        </div>

                    </div>
                    )}

                    <hr/>

                    <div className="row fw-bold">

                        <div className="col-md-8">
                            Food Profit / Loss
                        </div>

                        <div className="col-md-4 text-end">
                            ₹ {settlement.foodProfitLoss}
                        </div>

                    </div>

                </div>

            </div>

            {/* FINAL */}

            <div className="card border-dark">

                <div className="card-header bg-dark text-white">
                    Profit / Loss Summary
                </div>

                <div className="card-body">

                    <div className="row mb-2">

                        <div className="col-md-8">
                            Profit Remaining With Vintara
                        </div>

                        <div className="col-md-4 text-end">
                            ₹ {settlement.vintaraProfitLoss}
                        </div>

                    </div>

                    <div className="row mb-2">

                        <div className="col-md-8">
                            Profit Remaining With Property
                        </div>

                        <div className="col-md-4 text-end">
                            ₹ {settlement.propertyProfitLoss}
                        </div>

                    </div>

                    <div className="row mb-2">

                        <div className="col-md-8">
                            Food Profit
                        </div>

                        <div className="col-md-4 text-end">
                            ₹ {settlement.foodProfitLoss}
                        </div>

                    </div>

                    <hr/>

                    <div
                        className="row fw-bold fs-5 text-success"
                    >

                        <div className="col-md-8">
                            TOTAL PROFIT / LOSS
                        </div>

                        <div className="col-md-4 text-end">
                            ₹ {settlement.totalProfitLoss}
                        </div>

                    </div>

                </div>

            </div>

            </>
            )}

            {/* OWNER SETTLEMENT — Marketing models only. Vintara holds the
                full collection and either owes the owner or is owed by
                them, rather than a 3-way property/Vintara/food split. */}
            {isMarketingModel && settlement.ownerSettlementAmount !== null && settlement.ownerSettlementAmount !== undefined && (
            <div className={`card border-dark`}>

                <div className="card-header bg-dark text-white">
                    Owner Settlement
                </div>

                <div className="card-body">

                    <div
                        className={`row fw-bold fs-5 ${settlement.ownerSettlementAmount >= 0 ? "text-success" : "text-danger"}`}
                    >
                        <div className="col-md-8">
                            {settlement.ownerSettlementAmount >= 0
                                ? "Vintara owes the owner"
                                : "Owner owes Vintara"}
                        </div>

                        <div className="col-md-4 text-end">
                            ₹ {Math.abs(settlement.ownerSettlementAmount)}
                        </div>
                    </div>

                </div>

            </div>
            )}

        </div>

    </div>

</div>

)}

                </div>

            </div>

        </div>

    );

};

export default MonthlySettlement;