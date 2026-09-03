import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import "./RecordDailyEntryForm.css";
import config from "../config";
import Select from "react-select";

// Formats a Date as "yyyy-MM-dd" using local Y/M/D (not toISOString, which
// converts to UTC and can shift the date across a day boundary depending on
// the browser's timezone).
const toLocalDateString = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const emptyEnquiry = {
  name: "",
  contactNo: "",
  preferredLocation: "",
  propertyName: "",
  noOfPeople: "",
  status: "Open",
  source: "",
  feedback: "",
};

const RecordDailyEntryForm = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const dailyEntryToEdit = location.state?.dailyEntryToEdit || null;

  // State to manage multiple enquiries
  const [enquiries, setEnquiries] = useState(
    dailyEntryToEdit?.enquiries || [{ ...emptyEnquiry }]
  );

  // Single date applied to every enquiry in this batch, not one per entry.
  // Defaults to today.
  const [entryDate, setEntryDate] = useState(
    dailyEntryToEdit?.date ? new Date(dailyEntryToEdit.date) : new Date()
  );

  // Entries can be backdated, but only up to a month back.
  const minEntryDate = new Date();
  minEntryDate.setMonth(minEntryDate.getMonth() - 1);

  // Dropdown options. `propertyNames` here is deliberately the full list of
  // active properties, unfiltered by the logged-in user's resort
  // assignments — an enquiry can come in for any property, not just ones
  // this user is assigned to (unlike CreateBookingForm/UserDashboard, which
  // scope their resort pickers to the user's assignments).
  const [dropdownOptions, setDropdownOptions] = useState({
    locations: [],
    properties: [],
    statuses: [],
    sources: [],
  });

  // Fetch dropdown data
  const fetchDropdownData = async () => {
    try {
      const response = await fetch(
        `${config.BASE_URL}/api/drop-down/booking-enquiry`,
        {
          headers: config.getHeaders(),
        }
      );
      if (!response.ok) throw new Error("Failed to fetch dropdown data");
      const data = await response.json();

      setDropdownOptions({
        locations: data.preferredLocations || [],
        properties: data.propertyNames || [],
        statuses: data.bookingStatuses || [],
        sources: data.enquirySources || [],
      });
    } catch (err) {
      console.error("Error fetching dropdown data:", err);
    }
  };

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user) {
      navigate("/login");
    }
  }, [navigate]);

  useEffect(() => {
    fetchDropdownData();
  }, []);

  // Add new enquiry field
  const addEnquiryField = () => {
    setEnquiries([...enquiries, { ...emptyEnquiry }]);
  };

  // Remove enquiry field
  const removeEnquiryField = (index) => {
    setEnquiries(enquiries.filter((_, i) => i !== index));
  };

  // Handle input change
  const handleEnquiryChange = (e, index) => {
    const { name, value } = e.target;
    const updatedEnquiries = enquiries.map((enquiry, i) =>
      i === index ? { ...enquiry, [name]: value } : enquiry
    );
    setEnquiries(updatedEnquiries);
  };

  // Submit form
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate phone numbers only
    const invalidEntry = enquiries.find(
      (entry) => !/^\d{10}$/.test(entry.contactNo)
    );

    if (invalidEntry) {
      alert("Please enter a valid 10-digit Contact Number for all entries.");
      return;
    }

    const sanitizedEnquiries = enquiries.map((entry) => ({
      ...entry,
      noOfPeople: entry.noOfPeople === "" ? 0 : Number(entry.noOfPeople),
      date: toLocalDateString(entryDate),
    }));

    try {
      if (dailyEntryToEdit) {
        // Only one entry is being edited
        const updatedEntry = {
          ...dailyEntryToEdit,
          ...sanitizedEnquiries[0],
          date: `${toLocalDateString(entryDate)}T00:00:00`,
        };

        const response = await fetch(
          `${config.BASE_URL}/api/booking-enquiry/${dailyEntryToEdit.id}`,
          {
            method: "PUT",
            headers: config.getHeaders(),
            body: JSON.stringify(updatedEntry),
          }
        );

        if (!response.ok) throw new Error("Failed to update entry");

        navigate("/user/daily-entries", { state: { openDailyEntries: true } });
      } else {
        const response = await fetch(
          `${config.BASE_URL}/api/booking-enquiry/bulk`,
          {
            method: "POST",
            headers: config.getHeaders(),
            body: JSON.stringify(sanitizedEnquiries),
          }
        );

        if (!response.ok) throw new Error("Failed to save data");

        navigate("/user/daily-entries", { state: { openDailyEntries: true } });
      }
    } catch (err) {
      console.error("Error saving entries:", err);
      alert("Error saving entries. Please try again.");
    }
  };

  const locationOptions = dropdownOptions.locations.map((loc) => ({
    value: loc,
    label: loc,
  }));
  const propertyOptions = dropdownOptions.properties.map((prop) => ({
    value: prop.name,
    label: prop.name,
  }));
  const sourceOptions = dropdownOptions.sources.map((source) => ({
    value: source,
    label: source,
  }));

  return (
    <div className="daily-entry-form-wrapper">
      <h2 className="page-title" style={{ fontSize: "21px", fontWeight: 700, color: "var(--primary-teal)", textAlign: "center", letterSpacing: "0.2px", marginTop: 0, marginBottom: "18px" }}>
        {dailyEntryToEdit ? "Edit Daily Entry" : "Record Daily Entry"}
      </h2>

      <form onSubmit={handleSubmit} className="daily-entry-form">
        <div className="form-group entry-date-group">
          <label>Date</label>
          <DatePicker
            selected={entryDate}
            onChange={(date) => setEntryDate(date)}
            dateFormat="yyyy-MM-dd"
            minDate={minEntryDate}
            portalId="daily-entry-datepicker-portal"
          />
        </div>

        <div className="enquiries-container">
          <div className="enquiries-table-wrapper">
            <table className="enquiries-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Customer Name</th>
                  <th>Contact No</th>
                  <th>Preferred Location</th>
                  <th>Property Name</th>
                  <th>Enquiry Source</th>
                  <th>No of People</th>
                  <th>Feedback</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {enquiries.map((enquiry, index) => (
                  <tr key={index}>
                    <td className="row-number">{index + 1}</td>
                    <td>
                      <input
                        type="text"
                        name="name"
                        value={enquiry.name}
                        onChange={(e) => handleEnquiryChange(e, index)}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        name="contactNo"
                        maxLength="10"
                        pattern="\d{10}"
                        inputMode="numeric"
                        value={enquiry.contactNo}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, "");
                          handleEnquiryChange(
                            { target: { name: "contactNo", value } },
                            index
                          );
                        }}
                        required
                      />
                    </td>
                    <td>
                      <Select
                        classNamePrefix="react-select"
                        placeholder="Location"
                        options={locationOptions}
                        menuPortalTarget={document.body}
                        styles={{ menuPortal: (base) => ({ ...base, zIndex: 9999 }) }}
                        value={
                          locationOptions.find(
                            (option) => option.value === enquiry.preferredLocation
                          ) || null
                        }
                        onChange={(selected) =>
                          handleEnquiryChange(
                            {
                              target: {
                                name: "preferredLocation",
                                value: selected ? selected.value : "",
                              },
                            },
                            index
                          )
                        }
                      />
                    </td>
                    <td>
                      <Select
                        classNamePrefix="react-select"
                        placeholder="Property"
                        options={propertyOptions}
                        menuPortalTarget={document.body}
                        styles={{ menuPortal: (base) => ({ ...base, zIndex: 9999 }) }}
                        value={
                          propertyOptions.find(
                            (option) => option.value === enquiry.propertyName
                          ) || null
                        }
                        onChange={(selected) =>
                          handleEnquiryChange(
                            {
                              target: {
                                name: "propertyName",
                                value: selected ? selected.value : "",
                              },
                            },
                            index
                          )
                        }
                      />
                    </td>
                    <td>
                      <Select
                        classNamePrefix="react-select"
                        placeholder="Source"
                        options={sourceOptions}
                        menuPortalTarget={document.body}
                        styles={{ menuPortal: (base) => ({ ...base, zIndex: 9999 }) }}
                        value={
                          sourceOptions.find(
                            (option) => option.value === enquiry.source
                          ) || null
                        }
                        onChange={(selected) =>
                          handleEnquiryChange(
                            {
                              target: {
                                name: "source",
                                value: selected ? selected.value : "",
                              },
                            },
                            index
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        name="noOfPeople"
                        value={enquiry.noOfPeople}
                        onChange={(e) => handleEnquiryChange(e, index)}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        name="feedback"
                        value={enquiry.feedback}
                        onChange={(e) => handleEnquiryChange(e, index)}
                      />
                    </td>
                    <td className="row-actions">
                      {enquiries.length > 1 && (
                        <button
                          type="button"
                          className="remove-btn"
                          title="Remove row"
                          onClick={() => removeEnquiryField(index)}
                        >
                          ✕
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button type="button" className="add-btn" onClick={addEnquiryField}>
            + Add Another Enquiry
          </button>
        </div>

        <button type="submit" className="submit-btn">
          {dailyEntryToEdit ? "Update Entries" : "Record Entries"}
        </button>
      </form>
    </div>
  );
};

export default RecordDailyEntryForm;
