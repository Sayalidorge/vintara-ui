import React, { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import Select from "react-select";
import CreatableSelect from "react-select/creatable";
import config from "../config";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import "../css/theme.css";
import "./CreateBookingForm.css";
import { menuPortalTarget, menuPosition, themedSelectStyles } from "../utils/reactSelectTheme";
import { getUserRole } from "../utils/auth";
import ToastContainer, { useToast } from "./common/Toast";

// Formats a Date as "yyyy-MM-dd" using local Y/M/D (not toISOString, which
// converts to UTC and can shift the date across a day boundary depending on
// the browser's timezone).
const toLocalDateString = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const CreateBookingForm = () => {
  const { toasts, showToast, dismissToast } = useToast();
  const navigate = useNavigate();
  const { id: bookingId } = useParams();
  const location = useLocation();

  const currentUser = JSON.parse(localStorage.getItem("user"));
  // Front-desk roles mostly handle walk-in guests rather than phone sales -
  // default and prioritize Booking Source accordingly (see bookingSource
  // state and the sources fetch below), unlike USER/SUPER_USER/ADMIN who
  // stay defaulted to Vintara (phone) bookings.
  const isFrontDeskRole = getUserRole() === "PROPERTY_MANAGER" || getUserRole() === "RECEPTION";
  const today = toLocalDateString(new Date());

  const oneMonthAgo = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return toLocalDateString(d);
  })();

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
  const [isSubmitting, setIsSubmitting] = useState(false);

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
  const [customerEmail, setCustomerEmail] = useState("");
  const [phoneError, setPhoneError] = useState("");

  const [numberOfNights, setNumberOfNights] = useState(0);

  const [adults, setAdults] = useState(null);
  const [kids, setKids] = useState({ value: 0, label: "0" });
  const [remarks, setRemarks] = useState("");


  const [foodPreorder, setFoodPreorder] = useState(false);
  const [totalFoodAmount, setTotalFoodAmount] = useState("");
  const [advanceFoodAmount, setAdvanceFoodAmount] = useState("");
  const [foodBalanceAmount, setFoodBalanceAmount] = useState(0);

  const adultsOptions = Array.from({ length: 50 }, (_, i) => ({
    value: i + 1,
    label: String(i + 1),
  }));
  const kidsOptions = Array.from({ length: 11 }, (_, i) => ({
    value: i,
    label: String(i),
  }));

  const [totalAmount, setTotalAmount] = useState("");
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [balanceAmount, setBalanceAmount] = useState(0);

  // Only shown when the selected resort has more than one configured
  // advance-collection account - otherwise it's resolved automatically on
  // the backend with no choice needed, same as before this existed.
  const [advanceAccountOptions, setAdvanceAccountOptions] = useState([]);
  const [advanceAccount, setAdvanceAccount] = useState(null);
  // Captured from an edit-mode booking fetch before advanceAccountOptions
  // has necessarily loaded yet (the two fetches - booking data, and the
  // resort's advance accounts - run independently) - applied once both are
  // available, see the effect below.
  const [pendingAdvanceAccountId, setPendingAdvanceAccountId] = useState(null);

  const [gstPercent, setGstPercent] = useState("5");
  const [gstAmount, setGstAmount] = useState(0);
  const [transactionId, setTransactionId] = useState("");

  const [bookingSource, setBookingSource] = useState(isFrontDeskRole ? "WALKIN" : "CALL");
  const [bookingSourceOptions, setBookingSourceOptions] = useState([]);

  // Who gets performance credit for this sale - defaults to whoever's
  // logged in (the common case), overridable when entering a booking on
  // someone else's behalf (they took the call, this person is just typing
  // it in). Kept separate from createdByUserId (below), which always stays
  // the actual logged-in user regardless of this selection.
  const [leadOwnerOptions, setLeadOwnerOptions] = useState([]);
  const [leadOwner, setLeadOwner] = useState(null);

  // Derived from the backend's BookingSource.isOta() (via /api/bookings/sources)
  // instead of a hardcoded list here, which had drifted out of sync (a
  // "GOIBIBO" entry that isn't a real source, and was missing EASEMYTRIP).
  const isOTA = bookingSourceOptions.find((opt) => opt.value === bookingSource)?.isOta ?? false;

  // Contact number is only mandatory for Call / Call+GST / Walk-in - OTA
  // bookings often don't have the guest's number available at time of entry.
  const contactRequired = ["CALL", "CALLS_GST", "WALKIN"].includes(bookingSource);

  const [showGstFields, setShowGstFields] = useState(false);
  const [showGstPercent, setShowGstPercent] = useState(true);
  const [showAdvance, setShowAdvance] = useState(true);
  const [showBalanceAmount, setShowBalanceAmount] = useState(false);

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

        let options = data.map((src) => ({
          value: src.value,
          label: src.label,
          isOta: src.isOta,
        }));

        // Front-desk roles only ever handle these three sources (WALK-IN,
        // Vintara, Vintara + GST Bill) - OTA sources aren't relevant to them
        // day-to-day, so dropped entirely rather than just reordered.
        // Everyone else keeps the backend's full declared list/order.
        if (isFrontDeskRole) {
          const priority = ["WALKIN", "CALL", "CALLS_GST"];
          options = priority.map((v) => options.find((o) => o.value === v)).filter(Boolean);
        }

        setBookingSourceOptions(options);
      } catch (err) {
        console.error(err);
      }
    };

    fetchSources();
  }, [isFrontDeskRole]);

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
        break;

      case "BOOKING_COM":
        setShowGstFields(true);
        setShowGstPercent(false);
        setShowAdvance(true);
        setShowBalanceAmount(true);
        break;

      case "WALKIN":
        // No GST fields at all here - GST is entirely account-driven,
        // decided later by which payment account collects the (one-shot)
        // balance at check-in, not by anything entered at booking time.
        setShowAdvance(false);
        setShowBalanceAmount(false);
        setShowGstFields(false);

        setAdvanceAmount("0");
        setBalanceAmount(0);
        break;

      default:
        setShowAdvance(false);
        setShowBalanceAmount(false);

        setShowGstFields(true);
        setShowGstPercent(false);

        setAdvanceAmount(totalAmount);
        break;
    }
  }, [bookingSource, totalAmount]);

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
        // Inclusive of total (same convention as CALL, just based on total
        // instead of advance) - extracted from the entered amount rather
        // than added on top, so the total itself doesn't change.
        setGstAmount(((total * percent) / (100 + percent)).toFixed(2));
        break;

      default:
        // All OTA sources (Booking.com, MMT, Agoda, Airbnb, EaseMyTrip):
        // fixed 5% inclusive default - editable below, since the entered
        // amount is the whole booking (possibly multiple rooms), not a
        // per-room amount, so the 7500 slab can't be applied reliably here.
        // Staff overrides it directly when a room needs the 18% slab.
        if (isOTA) {
          setGstAmount(((total * 5) / 105).toFixed(2));
        }
        break;
    }
  }, [
    bookingSource,
    totalAmount,
    advanceAmount,
    gstPercent,
    isOTA,
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
  // Load Lead Owner options (USER + SUPER_USER staff)
  // -----------------------------
  useEffect(() => {
    const fetchLeadOwnerOptions = async () => {
      try {
        const res = await fetch(`${config.BASE_URL}/users/attendance-users`, {
          headers: config.getHeaders(),
        });
        const data = await res.json();
        const options = (data || []).map((u) => ({ value: u.id, label: u.name }));
        setLeadOwnerOptions(options);

        if (bookingId && prefillBookingData?.leadOwnerUserId) {
          const existing = options.find((o) => o.value === prefillBookingData.leadOwnerUserId);
          if (existing) {
            setLeadOwner(existing);
            return;
          }
        }
        // Default to whoever's logged in - the common case (same person
        // took the call and is entering it) needs no extra action.
        const self = options.find((o) => o.value === currentUser?.id);
        if (self) setLeadOwner(self);
      } catch (err) {
        console.error(err);
      }
    };

    fetchLeadOwnerOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId, prefillBookingData]);

  // Which accounts this resort's advance can be collected into - a dropdown
  // is only shown (below, in the payment section) when there's more than
  // one, otherwise it's resolved automatically on the backend exactly as
  // before this existed.
  useEffect(() => {
    if (!resort) {
      setAdvanceAccountOptions([]);
      setAdvanceAccount(null);
      return;
    }

    const fetchAdvanceAccounts = async () => {
      try {
        const res = await fetch(
          `${config.BASE_URL}/api/resorts/${resort.value}/advance-accounts`,
          { headers: config.getHeaders() }
        );
        const data = await res.json();
        const options = data.map((a) => ({ value: a.id, label: a.name }));
        setAdvanceAccountOptions(options);
      } catch (err) {
        console.error(err);
        setAdvanceAccountOptions([]);
      }
    };

    fetchAdvanceAccounts();
    setAdvanceAccount(null);
  }, [resort]);

  // Applies an edit-mode booking's previously-chosen advance account once
  // both the booking data and this resort's advance-account options have
  // loaded (the two fetches run independently).
  useEffect(() => {
    if (!pendingAdvanceAccountId || advanceAccountOptions.length === 0) return;
    const match = advanceAccountOptions.find((o) => o.value === pendingAdvanceAccountId);
    if (match) {
      setAdvanceAccount(match);
      setPendingAdvanceAccountId(null);
    }
  }, [pendingAdvanceAccountId, advanceAccountOptions]);

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
        setCustomerEmail(data.customerEmail || "");

        setCheckInDate(data.checkInDate || "");
        setCheckOutDate(data.checkOutDate || "");

        setAdults(
          data.adults ? { value: data.adults, label: String(data.adults) } : null
        );
        setKids(
          data.kids != null ? { value: data.kids, label: String(data.kids) } : null
        );
        setRemarks(data.remarks || "");

        setTotalAmount(data.totalAmount || "");
        setAdvanceAmount(data.advanceAmount || 0);
        setPendingAdvanceAccountId(data.advanceAccountId || null);

        setGstPercent(data.gstPercentage || "5");
        setTransactionId(data.transactionId || "");

        setBookingSource(data.source || "");

        setOtaCommission(data.otaCommission || "");

        setFoodPreorder(!!data.foodPreorder);
        setTotalFoodAmount(data.totalFoodAmount || "");
        setAdvanceFoodAmount(data.advanceFoodAmount || "");

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
  // Food Balance
  // -----------------------------
  useEffect(() => {
    const total = parseFloat(totalFoodAmount) || 0;
    const advance = parseFloat(advanceFoodAmount) || 0;

    setFoodBalanceAmount(total - advance >= 0 ? total - advance : 0);
  }, [totalFoodAmount, advanceFoodAmount]);

  // -----------------------------
  // Submit
  // -----------------------------
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!resort) {
      return showToast("Select Resort", "warning");
    }

    const invalidBookingItems = bookingItems.some(
      (item) => !item.category || item.rooms.length === 0
    );

    if (invalidBookingItems) {
      return showToast(
        "Select category and at least one room for all sections",
        "warning"
      );
    }

    if (
      !customerName ||
      (contactRequired && !customerContact) ||
      !checkInDate ||
      !checkOutDate
    ) {
      return showToast("Fill all required fields", "warning");
    }

    const bookingDataToSend = {
      resortId: resort.value,

      customerName,
      customerContactNumber: customerContact,
      customerEmail,

      checkInDate,
      checkOutDate,

      numberOfNights,
      adults: adults?.value ?? 0,
      kids: kids?.value ?? 0,
      remarks,

      totalAmount: parseFloat(totalAmount) || 0,
      advanceAmount: parseFloat(advanceAmount) || 0,
      advanceAccountId: advanceAccount?.value ?? null,
      balanceAmount: parseFloat(balanceAmount) || 0,

      gstPercentage: parseFloat(gstPercent) || 0,
      gstAmount: parseFloat(gstAmount) || 0,
      transactionId,

      source: bookingSource,

      createdByUserId: currentUser?.id,
      editedByUserId: currentUser?.id,
      leadOwnerUserId: leadOwner?.value ?? currentUser?.id,

      foodPreorder,
      totalFoodAmount: foodPreorder ? (parseFloat(totalFoodAmount) || 0) : 0,
      advanceFoodAmount: foodPreorder ? (parseFloat(advanceFoodAmount) || 0) : 0,
      foodBalanceAmount: foodPreorder ? (parseFloat(foodBalanceAmount) || 0) : 0,

      otaCommission: parseFloat(otaCommission) || 0,

      bookingItems: bookingItems.map((item) => ({
        roomCategoryId: item.category.value,
        roomIds: item.rooms.map((room) => room.value),
      })),
    };

    console.log("BOOKING DATA SENT TO BACKEND");
console.log(JSON.stringify(bookingDataToSend, null, 2));
    setIsSubmitting(true);
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
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.error || "Failed to save booking");
      }

      navigate("/user/dashboard", {
        state: {
          selectedResortId: resort.value,
        },
      });
    } catch (err) {
      console.error(err);
      showToast(err.message, "danger");
    } finally {
      setIsSubmitting(false);
    }
  };
  // -----------------------------
  // JSX
  // -----------------------------
  return (
    <div className="form-wrapper">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <form onSubmit={handleSubmit} className="booking-form">

        {/* CARD 1: Room & Stay Details */}
        <div className="booking-section-card full-width">
          <h3 className="booking-section-title">Room & Stay Details</h3>

        {/* Resort + Dates */}
        <div className="form-row">

          <div className="form-group">
            <label>Resort</label>

            <Select
              classNamePrefix="react-select"
              options={resortOptions}
              value={resort}
              onChange={setResort}
              placeholder="Select Resort"
              menuPortalTarget={menuPortalTarget}
                menuPosition={menuPosition}
              styles={themedSelectStyles()}
            />
          </div>

          <div className="form-group">
            <label>Check-in</label>

            <DatePicker
              className="date-picker-input"
              dateFormat="dd/MM/yyyy"
              placeholderText="Select check-in date"
              portalId="booking-datepicker-portal"
              selected={checkInDate ? new Date(checkInDate) : null}
              minDate={new Date(oneMonthAgo)}
              onChange={(date) => {
                if (!date) return;
                const newCheckIn = toLocalDateString(date);

                setCheckInDate(newCheckIn);

                if (
                  !checkOutDate ||
                  new Date(checkOutDate) <= new Date(newCheckIn)
                ) {
                  const nextDay = new Date(newCheckIn);

                  nextDay.setDate(nextDay.getDate() + 1);

                  setCheckOutDate(toLocalDateString(nextDay));
                }
              }}
              required
            />
          </div>

          <div className="form-group">
            <label>Check-out</label>

            <DatePicker
              className="date-picker-input"
              dateFormat="dd/MM/yyyy"
              placeholderText="Select check-out date"
              portalId="booking-datepicker-portal"
              selected={checkOutDate ? new Date(checkOutDate) : null}
              minDate={
                checkInDate
                  ? (() => {
                      const nextDay = new Date(checkInDate);
                      nextDay.setDate(nextDay.getDate() + 1);
                      return nextDay;
                    })()
                  : new Date(today)
              }
              onChange={(date) => {
                if (!date) return;
                const newCheckOut = toLocalDateString(date);
                if (checkInDate && new Date(newCheckOut) <= new Date(checkInDate)) {
                  const nextDay = new Date(checkInDate);
                  nextDay.setDate(nextDay.getDate() + 1);
                  setCheckOutDate(toLocalDateString(nextDay));
                } else {
                  setCheckOutDate(newCheckOut);
                }
              }}
              required
            />
          </div>

          <div className="form-group">
            <label>Nights</label>

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
                  <Select
                    classNamePrefix="react-select"
                    options={categoryOptions}
                    value={item.category}
                    onChange={(category) =>
                      updateCategory(index, category)
                    }
                    placeholder="Select Category"
                    isDisabled={!resort || !checkInDate || !checkOutDate}
                    menuPortalTarget={menuPortalTarget}
                menuPosition={menuPosition}
                    styles={themedSelectStyles()}
                  />
                </div>

                <div className="form-group">
                 <Select
  classNamePrefix="react-select"
  options={roomOptions}
  value={item.rooms}
  onChange={(rooms) => updateRooms(index, rooms)}
  isMulti
  placeholder="Select Rooms"
  isDisabled={!item.category}
  getOptionValue={(option) => option.value}
  menuPortalTarget={menuPortalTarget}
                menuPosition={menuPosition}
  styles={themedSelectStyles()}
/>
                </div>

                {(bookingItems.length > 1 ||
                  index === bookingItems.length - 1) && (
                  <div className="form-group action-buttons">
                    <div className="action-buttons-row">
                      {bookingItems.length > 1 && (
                        <button
                          type="button"
                          className="remove-btn"
                          onClick={() => removeBookingItem(index)}
                        >
                          Remove
                        </button>
                      )}

                      {index === bookingItems.length - 1 && (
                        <button
                          type="button"
                          className="add-category-btn"
                          onClick={addBookingItem}
                        >
                          + Add
                        </button>
                      )}
                    </div>
                  </div>
                )}

              </div>

            </div>
          );
        })}

        </div>

        {/* CARD 2: Customer Details */}
        <div className="booking-section-card">
          <h3 className="booking-section-title">Customer Details</h3>

          <div className="form-group">
            <label>Customer Name</label>

            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Customer Name"
            />
          </div>

          <div className="form-group">
            <label>Contact Number{contactRequired ? " *" : " (Optional)"}</label>

            <PhoneInput
              country="in"
              value={customerContact}
              onChange={(phone, country) => {
                setCustomerContact(phone);
                validatePhone(phone, country);
              }}
              inputProps={{
                onPaste: (e) => {
                  const pasted = e.clipboardData.getData("text");
                  // react-phone-input-2 counts pasted spaces/dashes as
                  // characters toward its digit mask, which pushes the
                  // trailing digit past the mask length and drops it.
                  // Stripping to digits-only before the library sees it
                  // avoids that.
                  if (/\D/.test(pasted)) {
                    e.preventDefault();
                    const rawDigits = pasted.replace(/\D/g, "");
                    // The library's value always includes the country's
                    // dial code (e.g. typing a national number normally
                    // yields "91XXXXXXXXXX"). A bare 10-digit paste has no
                    // dial code, so without prepending it the library
                    // misreads the leading digit(s) as some other
                    // country's code (e.g. "7" -> Russia).
                    const digitsOnly =
                      rawDigits.startsWith("91") && rawDigits.length > 10
                        ? rawDigits
                        : `91${rawDigits}`;
                    setCustomerContact(digitsOnly);
                    validatePhone(digitsOnly, { dialCode: "91", countryCode: "in" });
                  }
                },
              }}
            />

            {phoneError && (
              <small className="error-text">
                {phoneError}
              </small>
            )}
          </div>

          <div className="form-group">
            <label>Customer Email</label>

            <input
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="Customer Email (optional)"
            />
          </div>

          {/* Adults / Kids */}
          <div className="form-row">

            <div className="form-group">
              <label>Adults</label>
              <CreatableSelect
                classNamePrefix="react-select"
                options={adultsOptions}
                value={adults}
                onChange={setAdults}
                onCreateOption={(inputValue) => {
                  const parsed = parseInt(inputValue, 10);
                  if (!Number.isInteger(parsed) || parsed <= 0) return;
                  setAdults({ value: parsed, label: String(parsed) });
                }}
                isValidNewOption={(inputValue) => {
                  const parsed = parseInt(inputValue, 10);
                  return Number.isInteger(parsed) && parsed > 0 && String(parsed) === inputValue.trim();
                }}
                formatCreateLabel={(inputValue) => `Use ${inputValue} adults`}
                placeholder="Select or type"
                menuPortalTarget={menuPortalTarget}
                menuPosition={menuPosition}
                // "Select or type" wraps onto two lines in this narrow half-width
                // column, and the control's min-height (CreateBookingForm.css)
                // grows to fit that, making the box visibly taller than "Kids"
                // right next to it. react-select's valueContainer defaults to
                // flex-wrap:wrap (needed for multi-select chips to wrap), which
                // drops the whole placeholder onto its own second line before the
                // placeholder's own white-space even comes into play - nowrap on
                // the container itself is what actually keeps it to one line;
                // the placeholder override is a truncating (ellipsis) backstop.
                styles={themedSelectStyles({
                  valueContainer: (base) => ({ ...base, flexWrap: "nowrap" }),
                  placeholder: (base) => ({
                    ...base,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    minWidth: 0,
                  }),
                })}
              />
            </div>

            <div className="form-group">
              <label>Kids</label>
              <Select
                classNamePrefix="react-select"
                options={kidsOptions}
                value={kids}
                onChange={setKids}
                placeholder="Select Kids"
                menuPortalTarget={menuPortalTarget}
                menuPosition={menuPosition}
                styles={themedSelectStyles()}
              />
            </div>

          </div>
        </div>

        {/* CARD 3: Booking Source & Payment */}
        <div className="booking-section-card">
          <h3 className="booking-section-title">Booking Source &amp; Payment</h3>

          <div className="form-group">

            <label>Booking Source</label>

            <Select
              classNamePrefix="react-select"
              options={bookingSourceOptions}
              value={bookingSourceOptions.find(
                (option) => option.value === bookingSource
              )}
              onChange={(selected) =>
                setBookingSource(selected?.value)
              }
              placeholder="Select Booking Source"
              menuPortalTarget={menuPortalTarget}
                menuPosition={menuPosition}
              styles={themedSelectStyles()}
            />

          </div>
          {isOTA && (
            <div className="form-group">
              <label>OTA Commission</label>

              <input
                type="text"
                value={otaCommission}
                onChange={(e) => setOtaCommission(e.target.value)}
                placeholder="Enter OTA Commission"
              />
            </div>
          )}
          {bookingSource !== "WALKIN" && advanceAccountOptions.length > 1 && (
            <div className="form-group">
              <label>Advance Collection Account</label>

              <Select
                options={advanceAccountOptions}
                value={advanceAccount}
                onChange={setAdvanceAccount}
                placeholder="Select account..."
                classNamePrefix="react-select"
                menuPortalTarget={menuPortalTarget}
                menuPosition={menuPosition}
                styles={themedSelectStyles()}
              />
            </div>
          )}
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

          </div>

          {bookingSource !== "WALKIN" && showGstFields && (
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

                <label>GST Amount {isOTA && "(Editable)"}</label>

                <input
                  type="text"
                  value={gstAmount}
                  onChange={isOTA ? (e) => setGstAmount(e.target.value) : undefined}
                  readOnly={!isOTA}
                />

              </div>

            </div>
          )}

          {["CALL", "CALLS_GST", "BOOKING_COM", "WALKIN"].includes(bookingSource) && (
            <div className="form-group">
              <label>Transaction ID</label>

              <input
                type="text"
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                placeholder="Payment reference / UTR (optional)"
              />
            </div>
          )}
        </div>

        {/* CARD 4: Additional Details */}
        <div className="booking-section-card">
          <h3 className="booking-section-title">Additional Details</h3>

          <div className="form-group">

            <label>Lead Owner</label>

            <Select
              classNamePrefix="react-select"
              options={leadOwnerOptions}
              value={leadOwner}
              onChange={setLeadOwner}
              placeholder="Who gets credit for this sale?"
              menuPortalTarget={menuPortalTarget}
              menuPosition={menuPosition}
              styles={themedSelectStyles()}
            />

          </div>

          <div className="form-group food-preorder-toggle">
            <label>
              <input
                type="checkbox"
                checked={foodPreorder}
                onChange={(e) => setFoodPreorder(e.target.checked)}
              />
              Food Preorder
            </label>
          </div>

          {foodPreorder && (
            <div className="form-row">
              <div className="form-group">
                <label>Total</label>
                <input
                  type="text"
                  value={totalFoodAmount}
                  onChange={(e) => setTotalFoodAmount(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Advance</label>
                <input
                  type="text"
                  value={advanceFoodAmount}
                  onChange={(e) => setAdvanceFoodAmount(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Balance</label>
                <input type="text" value={foodBalanceAmount} readOnly />
              </div>
            </div>
          )}

          <div className="form-group">
            <label>Remarks</label>
            <textarea
              rows={3}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Any special requests or notes"
            />
          </div>
        </div>

        <button type="submit" className="submit-btn" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : bookingId ? "Update Booking" : "Create Booking"}
        </button>

      </form>
    </div>
  );
};

export default CreateBookingForm;