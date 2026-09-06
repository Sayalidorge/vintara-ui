// src/components/EditBookingForm.jsx
import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Select from "react-select";
import config from "../config";
import { menuPortalTarget, themedSelectStyles } from "../utils/reactSelectTheme";
import "./CreateBookingForm.css";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import { toLocalDateStr } from "../utils/date";

const EditBookingForm = () => {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const currentUser = JSON.parse(localStorage.getItem("user"));

  const [resortOptions, setResortOptions] = useState([]);
  const [resort, setResort] = useState(null);

  const [customerName, setCustomerName] = useState("");
  const [customerContact, setCustomerContact] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [checkInDate, setCheckInDate] = useState("");
  const [checkOutDate, setCheckOutDate] = useState("");
  const [numberOfPeople, setNumberOfPeople] = useState(2);

  const [totalAmount, setTotalAmount] = useState("");
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [balanceAmount, setBalanceAmount] = useState(0);
  const [gstPercent, setGstPercent] = useState("");
  const [numberOfNights, setNumberOfNights] = useState(0);
  const [bookingSource, setBookingSource] = useState("");

  const [categoryOptions, setCategoryOptions] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [roomOptions, setRoomOptions] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);

  const today = toLocalDateStr(new Date());

  // Phone validation
  const validatePhone = (value, country) => {
    const digits = value.replace(/\D/g, "");
    const dialCode = country.dialCode || "";
    const nationalNumber = digits.startsWith(dialCode)
      ? digits.slice(dialCode.length)
      : digits;

    if (country.countryCode === "in") {
      if (nationalNumber.length !== 10) {
        setPhoneError("Indian mobile number must be exactly 10 digits");
        return false;
      }
    }
    setPhoneError("");
    return true;
  };

  // Fetch active resorts
  useEffect(() => {
  const fetchResorts = async () => {
    try {
      let url = `${config.BASE_URL}/api/resorts/active`;
      const params = new URLSearchParams();

      // Send bookingId to ignore the current booking room
      if (bookingId) params.append("ignoreBookingId", bookingId);

      // Optional: send current check-in and check-out dates to filter booked rooms
      if (checkInDate) params.append("checkInDate", checkInDate);
      if (checkOutDate) params.append("checkOutDate", checkOutDate);

      if ([...params].length > 0) url += `?${params.toString()}`;

      const res = await fetch(url, {
        headers: config.getHeaders(),
      });

      if (!res.ok) throw new Error("Failed to fetch resorts");
      const data = await res.json();

      const options = data.map((r) => ({
        value: r.id,
        label: r.name,
        categories: r.categories,
      }));

      setResortOptions(options);

      // If resort was already selected, re-set it with fresh categories
      if (resort) {
        const updatedResort = options.find((r) => r.value === resort.value);
        if (updatedResort) setResort(updatedResort);
      }
    } catch (err) {
      console.error(err);
      alert("Error fetching resorts");
    }
  };
  fetchResorts();
}, [bookingId, checkInDate, checkOutDate]);


  // Fetch booking details
  useEffect(() => {
    const fetchBooking = async () => {
      try {
        const res = await fetch(`${config.BASE_URL}/api/bookings/${bookingId}`, {
          headers: config.getHeaders(),
        });
        if (!res.ok) throw new Error("Failed to fetch booking");
        const data = await res.json();

        setCustomerName(data.customerName);
        setCustomerContact(data.customerContactNumber);
        setCheckInDate(data.checkInDate);
        setCheckOutDate(data.checkOutDate);
        setNumberOfPeople(data.numberOfPeople);
        setTotalAmount(data.totalAmount);
        setAdvanceAmount(data.advanceAmount);
        setBalanceAmount(data.balanceAmount);
        setGstPercent(data.gstPercentage);
        setNumberOfNights(data.numberOfNights);
        setBookingSource(data.source);

        // Prefill resort
        const selectedResort = resortOptions.find(r => r.value === data.resortId) || {
          value: data.resortId,
          label: data.property,
          categories: data.categories
        };
        setResort(selectedResort);

        // Prefill category
        const selectedCat = {
          value: data.roomCategoryId,
          label: data.roomCategoryName,
          rooms: data.rooms
        };
        setSelectedCategory(selectedCat);

        // Prefill room
        setSelectedRoom({ value: data.roomId, label: data.roomNumber });

      } catch (err) {
        console.error(err);
        alert("Failed to fetch booking data");
      }
    };
    fetchBooking();
  }, [bookingId, resortOptions]);

  // Update categories when resort changes
  useEffect(() => {
    if (resort) {
      const categories = resort.categories
        .filter((cat) => cat.rooms.some((r) => r.active || (selectedRoom && cat.rooms.some(r => r.id === selectedRoom.value))))
        .map((cat) => ({ value: cat.id, label: cat.name, rooms: cat.rooms }));
      setCategoryOptions(categories);
    }
  }, [resort, selectedRoom]);

  // Update rooms when category changes
  useEffect(() => {
    if (selectedCategory) {
      const rooms = selectedCategory.rooms
        .filter((r) => r.active || (selectedRoom && r.id === selectedRoom.value))
        .map((r) => ({ value: r.id, label: r.roomNumber }));
      setRoomOptions(rooms);
    }
  }, [selectedCategory, selectedRoom]);

  // Calculate nights
  useEffect(() => {
    if (checkInDate && checkOutDate) {
      const nights =
        (new Date(checkOutDate) - new Date(checkInDate)) / (1000 * 60 * 60 * 24);
      setNumberOfNights(nights > 0 ? nights : 0);
    } else {
      setNumberOfNights(0);
    }
  }, [checkInDate, checkOutDate]);

  // Calculate balance
  useEffect(() => {
    const total = parseFloat(totalAmount) || 0;
    const advance = parseFloat(advanceAmount) || 0;
    const balance = total - advance;
    setBalanceAmount(balance >= 0 ? balance : 0);
  }, [totalAmount, advanceAmount]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!resort || !selectedCategory || !selectedRoom) {
      alert("Please select a Resort, Room Category, and Room.");
      return;
    }
    if (!customerName || !customerContact || !checkInDate || !checkOutDate) {
      alert("Please fill all required fields.");
      return;
    }

    const phoneValid = validatePhone(customerContact, { countryCode: "in", dialCode: "91" });
    if (!phoneValid) return;

    const bookingData = {
      resortId: resort.value,
      customerName,
      customerContactNumber: customerContact,
      checkInDate,
      checkOutDate,
      numberOfPeople,
      numberOfNights,
      totalAmount: parseFloat(totalAmount) || 0,
      advanceAmount: parseFloat(advanceAmount) || 0,
      balanceAmount,
      gstPercentage: parseFloat(gstPercent) || 0,
      roomCategoryId: selectedCategory.value,
      roomId: selectedRoom.value,
      source: bookingSource,
      editedByUserId: currentUser?.id, // record who edited
    };

    try {
      const res = await fetch(`${config.BASE_URL}/api/bookings/${bookingId}`, {
        method: "PUT",
        headers: config.getHeaders(),
        body: JSON.stringify(bookingData),
      });

      if (!res.ok) throw new Error("Failed to update booking");
      alert("Booking updated successfully!");
      navigate("/user/dashboard");
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  };

  return (
    <div className="form-wrapper">
      <h2 className="page-title">Edit Booking</h2>
      <form onSubmit={handleSubmit} className="booking-form">
        {/* Resort */}
        <div className="form-group">
          <label>Resort</label>
          <Select
            options={resortOptions}
            value={resort}
            onChange={setResort}
            placeholder="Select Resort"
            menuPortalTarget={menuPortalTarget}
            styles={themedSelectStyles()}
          />
        </div>

        {/* Room Category */}
        {categoryOptions.length > 0 && (
          <div className="form-group">
            <label>Room Category</label>
            <Select
              options={categoryOptions}
              value={selectedCategory}
              onChange={setSelectedCategory}
              placeholder="Select Room Category"
              menuPortalTarget={menuPortalTarget}
              styles={themedSelectStyles()}
            />
          </div>
        )}

        {/* Room */}
        {roomOptions.length > 0 && (
          <div className="form-group">
            <label>Room</label>
            <Select
              options={roomOptions}
              value={selectedRoom}
              onChange={setSelectedRoom}
              placeholder="Select Room"
              menuPortalTarget={menuPortalTarget}
              styles={themedSelectStyles()}
            />
          </div>
        )}

        {/* Customer Name */}
        <div className="form-group">
          <label>Customer Name</label>
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            required
          />
        </div>

        {/* Contact Number */}
        <div className="form-group">
          <label>Contact Number</label>
          <PhoneInput
            country="in"
            value={customerContact}
            onChange={(phone, country) => {
              setCustomerContact(phone);
              validatePhone(phone, country);
            }}
            countryCodeEditable={false}
            inputProps={{ name: "phone", required: true }}
          />
          {phoneError && <div style={{ color: "red", fontSize: 12 }}>{phoneError}</div>}
        </div>

        {/* Dates */}
        <div className="form-row">
          <div className="form-group">
            <label>Check-in Date</label>
            <input
              type="date"
              min={today}
              value={checkInDate}
              onChange={(e) => setCheckInDate(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Check-out Date</label>
            <input
              type="date"
              min={checkInDate || today}
              value={checkOutDate}
              onChange={(e) => setCheckOutDate(e.target.value)}
              required
            />
          </div>
        </div>

        {/* Number of People */}
        <div className="form-group">
          <label>Number of People</label>
          <input
            type="number"
            min={1}
            value={numberOfPeople}
            onChange={(e) => setNumberOfPeople(parseInt(e.target.value))}
            required
          />
        </div>

        {/* Nights */}
        <div className="form-group">
          <label>Number of Nights</label>
          <input type="number" value={numberOfNights} readOnly />
        </div>

        {/* Total Amount */}
        <div className="form-group">
          <label>Total Amount</label>
          <input
            type="number"
            min={0}
            value={totalAmount}
            onChange={(e) => setTotalAmount(e.target.value)}
          />
        </div>

        {/* Advance Amount */}
        <div className="form-group">
          <label>Advance Amount</label>
          <input
            type="number"
            min={0}
            value={advanceAmount}
            onChange={(e) => setAdvanceAmount(e.target.value)}
          />
        </div>

        {/* Balance Amount */}
        <div className="form-group">
          <label>Balance Amount</label>
          <input type="number" value={balanceAmount} readOnly />
        </div>

        {/* GST */}
        <div className="form-group">
          <label>GST Percentage</label>
          <Select
            options={[
              { value: 5, label: "5%" },
              { value: 12, label: "12%" },
              { value: 18, label: "18%" },
            ]}
            value={gstPercent ? { value: gstPercent, label: `${gstPercent}%` } : null}
            onChange={(g) => setGstPercent(g.value)}
            placeholder="Select GST %"
            isClearable
            menuPortalTarget={menuPortalTarget}
            styles={themedSelectStyles()}
          />
        </div>

        {/* Booking Source */}
        <div className="form-group">
          <label>Booking Source</label>
          <Select
            options={[
              { value: "BOOKING_COM", label: "BOOKING.COM" },
              { value: "MMT", label: "MMT" },
              { value: "AGODA", label: "AGODA" },
              { value: "AIRBNB", label: "AIRBNB" },
              { value: "CALL", label: "CALL" },
              { value: "WALKIN", label: "WALKIN" },
            ]}
            value={bookingSource ? { value: bookingSource, label: bookingSource } : null}
            onChange={(bs) => setBookingSource(bs.value)}
            placeholder="Select booking source"
            isClearable
            menuPortalTarget={menuPortalTarget}
            styles={themedSelectStyles()}
          />
        </div>

        <button type="submit" className="submit-btn">
          Update Booking
        </button>
      </form>
    </div>
  );
};

export default EditBookingForm;
