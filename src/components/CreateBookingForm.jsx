import React, { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import Select from "react-select";
import config from "../config";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import "./CreateBookingForm.css";

const CreateBookingForm = () => {
  const navigate = useNavigate();
  const { id: bookingId } = useParams();
  const location = useLocation();

  const currentUser = JSON.parse(localStorage.getItem("user"));
  const today = new Date().toISOString().split("T")[0];

  // -----------------------------
  // Prefill
  // -----------------------------
  const prefillResortId = location.state?.selectedResortId;
  const prefillBookingData = location.state?.bookingData;

  // -----------------------------
  // State
  // -----------------------------
  const [resortOptions, setResortOptions] = useState([]);
  const [resort, setResort] = useState(null);

  const [categoryOptions, setCategoryOptions] = useState([]);

  const [bookingItems, setBookingItems] = useState([
    {
      category: null,
      rooms: [],
    },
  ]);

  const [checkInDate, setCheckInDate] = useState("");
  const [checkOutDate, setCheckOutDate] = useState("");

  const [customerName, setCustomerName] = useState("");
  const [customerContact, setCustomerContact] = useState("");
  const [phoneError, setPhoneError] = useState("");

  const [numberOfPeople, setNumberOfPeople] = useState("");
  const [numberOfNights, setNumberOfNights] = useState(0);

  const [totalAmount, setTotalAmount] = useState("");
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [balanceAmount, setBalanceAmount] = useState(0);

  const [gstPercent, setGstPercent] = useState("5");
  const [gstAmount, setGstAmount] = useState(0);

  const [bookingSource, setBookingSource] = useState("");
  const [bookingSourceOptions, setBookingSourceOptions] = useState([]);

  const [showGstFields, setShowGstFields] = useState(false);
  const [showGstPercent, setShowGstPercent] = useState(true);
  const [showAdvance, setShowAdvance] = useState(true);
  const [showBalanceAmount, setShowBalanceAmount] = useState(false);

  const [walkinGstApplied, setWalkinGstApplied] = useState(false);

  const [showFinalAmount, setShowFinalAmount] = useState(false);
  const [finalAmount, setFinalAmount] = useState(0);
  const [otaCommission, setOtaCommission] = useState("");
  // -----------------------------
  // Booking Item Methods
  // -----------------------------
  const addBookingItem = () => {
    setBookingItems((prev) => [
      ...prev,
      {
        category: null,
        rooms: [],
      },
    ]);
  };

  const removeBookingItem = (index) => {
    setBookingItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateCategory = (index, category) => {
    const updated = [...bookingItems];

    updated[index].category = category;
    updated[index].rooms = [];

    setBookingItems(updated);
  };

  const updateRooms = (index, rooms) => {
    const updated = [...bookingItems];

    updated[index].rooms = rooms || [];

    setBookingItems(updated);
  };

  // -----------------------------
  // Phone validation
  // -----------------------------
  const validatePhone = (value, country) => {
    const digits = value.replace(/\D/g, "");

    const dialCode = country.dialCode || "";

    const nationalNumber = digits.startsWith(dialCode)
      ? digits.slice(dialCode.length)
      : digits;

    if (country.countryCode === "in" && nationalNumber.length !== 10) {
      setPhoneError("Indian mobile number must be exactly 10 digits");
      return false;
    }

    setPhoneError("");
    return true;
  };

  // -----------------------------
  // Load booking sources
  // -----------------------------
  useEffect(() => {
    const fetchSources = async () => {
      try {
        const res = await fetch(`${config.BASE_URL}/api/bookings/sources`, {
          headers: config.getHeaders(),
        });

        const data = await res.json();

        setBookingSourceOptions(
          data.map((src) => ({
            value: src.value,
            label: src.label,
          }))
        );
      } catch (err) {
        console.error(err);
      }
    };

    fetchSources();
  }, []);

  // -----------------------------
  // GST & Advance Logic
  // -----------------------------
  useEffect(() => {
    switch (bookingSource) {
      case "CALL":
      case "CALLS_GST":
        setShowGstFields(true);
        setShowGstPercent(true);
        setShowAdvance(true);
        setShowBalanceAmount(true);
        setShowFinalAmount(false);
        break;

      case "BOOKING_COM":
        setShowGstFields(true);
        setShowGstPercent(false);
        setShowAdvance(true);
        setShowBalanceAmount(true);
        setShowFinalAmount(false);
        break;

      case "WALKIN":
        setShowAdvance(false);
        setShowBalanceAmount(false);
        setShowFinalAmount(true);
        setShowGstFields(walkinGstApplied);
        setShowGstPercent(true);

        setAdvanceAmount("0");
        setBalanceAmount(0);
        break;

      default:
        setShowAdvance(false);
        setShowBalanceAmount(false);
        setShowFinalAmount(false);

        setShowGstFields(true);
        setShowGstPercent(false);

        setAdvanceAmount(totalAmount);
        break;
    }
  }, [bookingSource, walkinGstApplied, totalAmount]);

  // -----------------------------
  // GST Calculation
  // -----------------------------
  useEffect(() => {
    const total = parseFloat(totalAmount) || 0;
    const advance = parseFloat(advanceAmount) || 0;
    const percent = parseFloat(gstPercent) || 0;

    switch (bookingSource) {
      case "CALL":
        setGstAmount(((advance * percent) / (100 + percent)).toFixed(2));
        break;

      case "CALLS_GST":
        setGstAmount(((total * percent) / 100).toFixed(2));
        break;

      case "BOOKING_COM":
        const bPercent = total <= 7500 ? 5 : 18;
        setGstAmount(((total * bPercent) / (100 + bPercent)).toFixed(2));
        break;

      case "WALKIN":
        if (walkinGstApplied) {
          const gst = (total * percent) / 100;

          setGstAmount(gst.toFixed(2));
          setFinalAmount((total + gst).toFixed(2));
        } else {
          setGstAmount(0);
          setFinalAmount(total.toFixed(2));
        }
        break;

      default:
        break;
    }
  }, [
    bookingSource,
    totalAmount,
    advanceAmount,
    gstPercent,
    walkinGstApplied,
  ]);

  
  // -----------------------------
  // Load Resorts
  // -----------------------------
  useEffect(() => {
    const fetchResorts = async () => {
      try {
        const res = await fetch(
          `${config.BASE_URL}/api/resorts/resort-names-drop-down`,
          {
            headers: config.getHeaders(),
          }
        );

        const data = await res.json();

        const options = data.map((r) => ({
          value: r.id,
          label: r.name,
          categories: r.categories || [],
        }));

        setResortOptions(options);

        if (bookingId && prefillBookingData) {
          const resortOption = options.find(
            (r) => r.value === prefillBookingData.resortId
          );

          if (resortOption) {
            setResort(resortOption);
          }
        } else if (prefillResortId) {
          const resortOption = options.find(
            (r) => r.value === prefillResortId
          );

          if (resortOption) {
            setResort(resortOption);
          }
        }
      } catch (err) {
        console.error(err);
      }
    };

    fetchResorts();
  }, [bookingId, prefillBookingData, prefillResortId]);

  // -----------------------------
  // Edit Booking
  // -----------------------------
  useEffect(() => {
    if (!bookingId) return;

    const fetchBooking = async () => {
      try {
        const res = await fetch(
          `${config.BASE_URL}/api/bookings/${bookingId}`,
          {
            headers: config.getHeaders(),
          }
        );

        const data = await res.json();

        setCustomerName(data.customerName || "");
        setCustomerContact(data.customerContactNumber || "");

        setCheckInDate(data.checkInDate || "");
        setCheckOutDate(data.checkOutDate || "");

        setNumberOfPeople(data.numberOfPeople || "");

        setTotalAmount(data.totalAmount || "");
        setAdvanceAmount(data.advanceAmount || 0);

        setGstPercent(data.gstPercentage || "5");

        setBookingSource(data.source || "");

        setOtaCommission(data.otaCommission || "");

        // MULTI ROOM PREFILL
if (data.bookingItems?.length > 0) {

  const mappedItems = data.bookingItems.map((item) => ({

    category: {
      value: item.roomCategoryId,
      label: item.roomCategoryName,
    },

    rooms:
      item.roomIds?.map((id, index) => ({
        value: id,
        label: item.roomNumbers[index],
      })) || [],

  }));

  setBookingItems(mappedItems);
}
      } catch (err) {
        console.error(err);
      }
    };

    fetchBooking();
  }, [bookingId]);

// -----------------------------
  useEffect(() => {

    if (!isOTA) {
        setOtaCommission("");
    }

}, [bookingSource]);
  // -----------------------------
  // Load Categories + Rooms
  // -----------------------------
  useEffect(() => {
    if (!resort || !checkInDate || !checkOutDate) return;

    const fetchCategoriesAndRooms = async () => {
      try {
        let url = `${config.BASE_URL}/api/resorts/active?checkInDate=${checkInDate}&checkOutDate=${checkOutDate}`;

        if (bookingId) {
          url += `&ignoreBookingId=${bookingId}`;
        }

        const res = await fetch(url, {
          headers: config.getHeaders(),
        });

        const data = await res.json();

        const resortData = data.find((r) => r.id === resort.value);

        if (!resortData) return;

        const categories = (resortData.categories || [])
          .filter((c) => c.rooms?.length > 0)
          .map((c) => ({
            value: c.id,
            label: c.name,
            rooms: c.rooms,
          }));

        setCategoryOptions(categories);
      } catch (err) {
        console.error(err);
      }
    };

    fetchCategoriesAndRooms();
  }, [resort, checkInDate, checkOutDate, bookingId]);

  // -----------------------------
  // Nights Calculation
  // -----------------------------
  useEffect(() => {
    if (checkInDate && checkOutDate) {
      const nights =
        (new Date(checkOutDate) - new Date(checkInDate)) /
        (1000 * 60 * 60 * 24);

      setNumberOfNights(nights > 0 ? nights : 0);
    }
  }, [checkInDate, checkOutDate]);

  // -----------------------------
  // Balance
  // -----------------------------
  useEffect(() => {
    const total = parseFloat(totalAmount) || 0;
    const advance = parseFloat(advanceAmount) || 0;

    setBalanceAmount(total - advance >= 0 ? total - advance : 0);
  }, [totalAmount, advanceAmount]);

  // -----------------------------
  // Submit
  // -----------------------------
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!resort) {
      return alert("Select Resort");
    }

    const invalidBookingItems = bookingItems.some(
      (item) => !item.category || item.rooms.length === 0
    );

    if (invalidBookingItems) {
      return alert(
        "Select category and at least one room for all sections"
      );
    }

    if (
      !customerName ||
      !customerContact ||
      !checkInDate ||
      !checkOutDate
    ) {
      return alert("Fill all required fields");
    }

    const bookingDataToSend = {
      resortId: resort.value,

      customerName,
      customerContactNumber: customerContact,

      checkInDate,
      checkOutDate,

      numberOfPeople,
      numberOfNights,

      totalAmount: parseFloat(totalAmount) || 0,
      advanceAmount: parseFloat(advanceAmount) || 0,
      balanceAmount: parseFloat(balanceAmount) || 0,

      gstPercentage: parseFloat(gstPercent) || 0,
      gstAmount: parseFloat(gstAmount) || 0,

      source: bookingSource,

      createdByUserId: currentUser?.id,
      editedByUserId: currentUser?.id,

      walkinGstApplied,

      otaCommission: parseFloat(otaCommission) || 0,

      bookingItems: bookingItems.map((item) => ({
        roomCategoryId: item.category.value,
        roomIds: item.rooms.map((room) => room.value),
      })),
    };

    console.log("BOOKING DATA SENT TO BACKEND");
console.log(JSON.stringify(bookingDataToSend, null, 2));
    try {
      let res;

      if (bookingId) {
        res = await fetch(`${config.BASE_URL}/api/bookings/${bookingId}`, {
          method: "PUT",
          headers: config.getHeaders(),
          body: JSON.stringify(bookingDataToSend),
        });
      } else {
        res = await fetch(`${config.BASE_URL}/api/bookings`, {
          method: "POST",
          headers: config.getHeaders(),
          body: JSON.stringify(bookingDataToSend),
        });
      }

      if (!res.ok) {
        throw new Error("Failed to save booking");
      }

      navigate("/user/dashboard", {
        state: {
          selectedResortId: resort.value,
        },
      });
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  };

  const isOTA = [
  "BOOKING_COM",
  "AGODA",
  "MMT",
  "GOIBIBO",
  "AIRBNB"
].includes(bookingSource);
  // -----------------------------
  // JSX
  // -----------------------------
  return (
    <div className="form-wrapper">
      <h2>{bookingId ? "Edit Booking" : "Create Booking"}</h2>

      <form onSubmit={handleSubmit} className="booking-form">

        {/* Resort */}
        <div className="form-group">
          <label>Resort</label>

          <Select
            options={resortOptions}
            value={resort}
            onChange={setResort}
            placeholder="Select Resort"
          />
        </div>

        {/* Dates */}
        <div className="form-row">

          <div className="form-group">
            <label>Check-in</label>

            <input
              type="date"
              min={today}
              value={checkInDate}
              onChange={(e) => {
                const newCheckIn = e.target.value;

                setCheckInDate(newCheckIn);

                if (
                  !checkOutDate ||
                  new Date(checkOutDate) <= new Date(newCheckIn)
                ) {
                  const nextDay = new Date(newCheckIn);

                  nextDay.setDate(nextDay.getDate() + 1);

                  setCheckOutDate(nextDay.toISOString().split("T")[0]);
                }
              }}
              required
            />
          </div>

          <div className="form-group">
            <label>Check-out</label>

            <input
              type="date"
              min={checkInDate || today}
              value={checkOutDate}
              onChange={(e) => setCheckOutDate(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>No. of Nights</label>

            <input type="text" value={numberOfNights} readOnly />
          </div>

        </div>

        {/* Dynamic Booking Items */}
        {bookingItems.map((item, index) => {

const selectedCategory = categoryOptions.find(
  (c) => c.value === item.category?.value
);

const selectedRoomIds = bookingItems
  .filter((_, i) => i !== index) // ignore current booking item
  .flatMap(item => item.rooms || [])
  .map(room => room.value);

const backendRooms =
  selectedCategory?.rooms
    ?.filter(room => !selectedRoomIds.includes(room.id))
    .map(room => ({
      value: room.id,
      label: room.roomNumber,
    })) || [];
const normalizeRooms = (rooms = []) =>
  rooms.map((r) => ({
    value: r.value || r.id,
    label: r.label || r.roomNumber,
  }));  

// merge selected rooms so React-Select never loses them

const roomOptionsMap = new Map();

backendRooms.forEach((room) => {
  roomOptionsMap.set(room.value, room);
});

(item.rooms || []).forEach((room) => {
  roomOptionsMap.set(room.value, room);
});

const roomOptions = Array.from(roomOptionsMap.values());


          return (
            <div key={index} className="booking-item-card">

              <div className="form-row">

                <div className="form-group">
                  <label>Category</label>

                  <Select
                    options={categoryOptions}
                    value={item.category}
                    onChange={(category) =>
                      updateCategory(index, category)
                    }
                    placeholder="Select Category"
                    isDisabled={!resort || !checkInDate || !checkOutDate}
                  />
                </div>

                <div className="form-group">
                  <label>Rooms</label>

                 <Select
  options={roomOptions}
  value={item.rooms}
  onChange={(rooms) => updateRooms(index, rooms)}
  isMulti
  placeholder="Select Rooms"
  isDisabled={!item.category}
  getOptionValue={(option) => option.value}
/>
                </div>

              </div>

              {bookingItems.length > 1 && (
                <button
                  type="button"
                  className="remove-btn"
                  onClick={() => removeBookingItem(index)}
                >
                  Remove
                </button>
              )}

            </div>
          );
        })}

        <button
          type="button"
          className="add-category-btn"
          onClick={addBookingItem}
        >
          + Add Another Category
        </button>

        {/* Customer Info */}
        <div className="form-row three-fields">

          <div className="form-group">
            <label>Customer Name</label>

            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Customer Name"
            />
          </div>

          <div className="form-group">
            <label>Contact Number</label>

            <PhoneInput
              country="in"
              value={customerContact}
              onChange={(phone, country) => {
                setCustomerContact(phone);
                validatePhone(phone, country);
              }}
            />

            {phoneError && (
              <small className="error-text">
                {phoneError}
              </small>
            )}
          </div>

          <div className="form-group">
            <label>No. of People</label>

<input
  type="text"
  placeholder="e.g., 2 adults"
  value={numberOfPeople}
  onChange={(e) => setNumberOfPeople(e.target.value)}
/>
          </div>

        </div>

        {/* Booking Source */}
        <div className="form-group">

          <label>Booking Source</label>

          <Select
            options={bookingSourceOptions}
            value={bookingSourceOptions.find(
              (option) => option.value === bookingSource
            )}
            onChange={(selected) =>
              setBookingSource(selected?.value)
            }
            placeholder="Select Booking Source"
          />

        </div>
          {isOTA && (
  <div className="form-group">
    <label>OTA Commission</label>

    <input
      type="number"
      min="0"
      value={otaCommission}
      onChange={(e) => setOtaCommission(e.target.value)}
      placeholder="Enter OTA Commission"
    />
  </div>
)}
        {/* Walkin GST */}
        {bookingSource === "WALKIN" && (
          <div className="form-group">

            <label>Apply GST?</label>

            <select
              value={walkinGstApplied}
              onChange={(e) =>
                setWalkinGstApplied(e.target.value === "true")
              }
            >
              <option value="false">No</option>
              <option value="true">Yes</option>
            </select>

          </div>
        )}

        {/* Amounts */}
        <div className="form-row">

          <div className="form-group">
            <label>Total Amount</label>

            <input
              type="text"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
            />
          </div>

          {showAdvance && (
            <div className="form-group">
              <label>Advance</label>

              <input
                type="text"
                value={advanceAmount}
                onChange={(e) => setAdvanceAmount(e.target.value)}
              />
            </div>
          )}

          {showBalanceAmount && (
            <div className="form-group">
              <label>Balance</label>

              <input type="text" value={balanceAmount} readOnly />
            </div>
          )}

          {showFinalAmount && (
            <div className="form-group">
              <label>Final Amount</label>

              <input type="text" value={finalAmount} readOnly />
            </div>
          )}

        </div>

        {/* GST */}
        {showGstFields && (
          <div className="form-row">

            {showGstPercent && (
              <div className="form-group">

                <label>GST %</label>

                <input
                  type="number"
                  value={gstPercent}
                  onChange={(e) => setGstPercent(e.target.value)}
                />

              </div>
            )}

            <div className="form-group">

              <label>GST Amount</label>

              <input
                type="text"
                value={gstAmount}
                readOnly
              />

            </div>

          </div>
        )}

        <button type="submit" className="submit-btn">
          {bookingId ? "Update Booking" : "Create Booking"}
        </button>

      </form>
    </div>
  );
};

export default CreateBookingForm;