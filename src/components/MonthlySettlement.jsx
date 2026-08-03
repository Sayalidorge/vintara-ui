import React, { useEffect, useState } from "react";
import Select from "react-select";
import config from "../config";
import "./MonthlySettlement.css";

const MonthlySettlement = () => {

    const [resorts, setResorts] = useState([]);
    const [selectedResort, setSelectedResort] = useState(null);
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [settlement, setSettlement] = useState(null);
    const [loading, setLoading] = useState(false);

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

    return (

        <div className="container-fluid mt-4">

            <div className="card shadow-sm">

                <div className="card-header">
                    <h4 className="mb-0">Monthly Settlement</h4>
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
                </small>

            </div>

            <div>

                <button className="btn btn-light btn-sm me-2">
                    Export Excel
                </button>

                <button className="btn btn-danger btn-sm me-2">
                    Export PDF
                </button>

                <button className="btn btn-success btn-sm">
                    Finalize
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

                    <div className="row mb-2">
                        <div className="col-md-8">Marketing Commission</div>
                        <div className="col-md-4 text-end">
                            ₹ {settlement.marketingCommission}
                        </div>
                    </div>

                    <div className="row mb-2">
                        <div className="col-md-8">Property Expense</div>
                        <div className="col-md-4 text-end">
                            ₹ {settlement.propertyExpense}
                        </div>
                    </div>

                    <div className="row mb-2">
                        <div className="col-md-8">Vintara Expense</div>
                        <div className="col-md-4 text-end">
                            ₹ {settlement.vintaraExpense}
                        </div>
                    </div>

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

            {/* FOOD */}

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