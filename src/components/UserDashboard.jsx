import { useState, useEffect } from "react";
import Select from "react-select";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { useNavigate, useLocation } from "react-router-dom";
import "../css/theme.css";
import "./UserDashboard.css";
import config from "../config";

const UserDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [resorts, setResorts] = useState([]);
  const [selectedResort, setSelectedResort] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(null);

  const selectedResortFromNav = location.state?.selectedResortId;

  useEffect(() => {
    const fetchResorts = async () => {
      try {
        const res = await fetch(
          `${config.BASE_URL}/api/resorts/resort-names-drop-down`,
          { headers: config.getHeaders() }
        );
        const data = await res.json();
        const options = data.map(r => ({
          value: r.id,
          label: r.name,
          categories: r.categories || [],
        }));
        setResorts(options);

        if (selectedResortFromNav) {
          const resortOption = options.find(r => r.value === selectedResortFromNav);
          if (resortOption) {
            setSelectedResort(resortOption);
            navigate(location.pathname, { replace: true, state: {} });
            return;
          }
        }
        if (options.length > 0 && !selectedResort) setSelectedResort(options[0]);
      } catch (err) {
        console.error(err);
        setResorts([]);
        setSelectedResort(null);
      }
    };
    fetchResorts();
  }, [selectedResortFromNav, navigate, location.pathname, selectedResort]);

  useEffect(() => {
    if (!selectedResort) return setBookings([]);
    const fetchBookings = async () => {
      try {
        let url = `${config.BASE_URL}/api/bookings?resortId=${selectedResort.value}`;
        if (fromDate) url += `&fromDate=${fromDate.toISOString().split("T")[0]}`;
        if (toDate) url += `&toDate=${toDate.toISOString().split("T")[0]}`;
        const res = await fetch(url, { headers: config.getHeaders() });
        const data = await res.json();
        setBookings(data.sort((a, b) => new Date(a.checkInDate) - new Date(b.checkInDate)));
      } catch (err) {
        console.error(err);
        setBookings([]);
      }
    };
    fetchBookings();
  }, [selectedResort, fromDate, toDate]);

  const resetFilters = () => {
    setFromDate(new Date());
    setToDate(null);
  };

  const handleEditBooking = (booking) => {
    navigate(`/user/create-booking/${booking.id}`, {
      state: { bookingData: booking, resortOptions: resorts },
    });
  };

  const handleCreateBooking = () => navigate("/create-booking");

  return (
    < >
    <div className="page-header">
  <h2>User Dashboard</h2>
</div>
        {/* Filters */}
        <div className="dashboard-filters">
          <div className="filter-item">
            <label>Resort</label>
<Select
  options={resorts}
  value={selectedResort}
  onChange={setSelectedResort}
  placeholder="Select resort..."
  isDisabled={resorts.length === 0}
  classNamePrefix="react-select"
  // remove menuPortalTarget to keep inside form
  styles={{
    control: (base, state) => ({
      ...base,
      minHeight: 36,       // match DatePicker
      height: 36,          // exact height
      borderRadius: 5,     
      borderColor: state.isFocused ? "var(--primary-teal)" : "#ccc",
      boxShadow: state.isFocused ? "0 0 0 1px var(--primary-teal)" : "none",
      '&:hover': { borderColor: "var(--primary-teal)" },
    }),
    valueContainer: (base) => ({
      ...base,
      height: 36,
      padding: "0 8px",
    }),
    input: (base) => ({ ...base, margin: 0, padding: 0, height: "100%" }),
    placeholder: (base) => ({ ...base, margin: 0, lineHeight: "36px" }),
    singleValue: (base) => ({ ...base, lineHeight: "36px" }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isFocused ? "var(--primary-teal)" : "#fff",
      color: state.isFocused ? "#fff" : "#333",
    }),
    indicatorsContainer: (base) => ({ ...base, height: 36 }),
    dropdownIndicator: (base) => ({ ...base, padding: "0 8px" }),
  }}
/>
          </div>
          <div className="filter-item">
            <label>From Date</label>
            <DatePicker
              selected={fromDate}
              onChange={setFromDate}
              dateFormat="yyyy-MM-dd"
            />
          </div>
          <div className="filter-item">
            <label>To Date</label>
            <DatePicker
              selected={toDate}
              onChange={setToDate}
              dateFormat="yyyy-MM-dd"
              placeholderText="Optional"
            />
          </div>
        <div className="filter-item">
  <label style={{ visibility: "hidden" }}>Reset</label>
  <button onClick={resetFilters} className="reset-filters-btn">
    Reset Filters
  </button>
</div>
        </div>

        {/* Table */}
        <div className="table-wrapper">
          <table className="bookings-table">
            <thead>
              <tr>
             
                <th>Customer</th>
                <th>Contact</th>
                <th>Check-in</th>
                <th>Check-out</th>
                <th>People</th>
                <th>Nights</th>
                <th>Total</th>
                <th>Advance</th>
                <th>Balance</th>
                <th>GST %</th>
                <th>GST Amount</th>
                <th>Source</th>
                <th>Room Category</th>
                <th>Room</th>
                <th>Created By</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {bookings.length > 0 ? bookings.map(b => (
                <tr key={b.id}>
             
                  <td>{b.customerName}</td>
                  <td>{b.customerContactNumber}</td>
                  <td>{b.checkInDate}</td>
                  <td>{b.checkOutDate}</td>
                  <td>{b.numberOfPeople}</td>
                  <td>{b.numberOfNights}</td>
                  <td>{b.totalAmount}</td>
                  <td>{b.advanceAmount}</td>
                  <td>{b.balanceAmount}</td>
                  <td>{b.gstPercentage}</td>
                  <td>{b.gstAmount}</td>
                  <td>{b.source}</td>
                 <td>
  {b.bookingItems?.length
    ? b.bookingItems.map((item, i) => (
        <div key={i}>
          {item.roomCategoryName}
        </div>
      ))
    : "-"}
</td>

<td>
  {b.bookingItems?.length
    ? b.bookingItems.map((item, i) => (
        <div key={i}>
          {item.roomNumbers?.join(", ")}
        </div>
      ))
    : "-"}
</td>
                  <td>{b.createdByUser || "-"}</td>
                  <td>
                    <button onClick={() => handleEditBooking(b)} className="btn-edit">Edit</button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="17">No bookings found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </>
  );
};

export default UserDashboard;