import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./RecordDailyEntryForm.css";
import config from "../config";
import Select from "react-select";


const RecordDailyEntryForm = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const dailyEntryToEdit = location.state?.dailyEntryToEdit || null;

  // State to manage multiple enquiries
  const [enquiries, setEnquiries] = useState(
    dailyEntryToEdit?.enquiries || [
      {
        name: "",
        contactNo: "",
        preferredLocation: "",
        propertyName: "",
        noOfPeople: "",
        source: "",
        feedback: "",
      },
    ]
  );

  // Dropdown options
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
  console.log("User from localStorage on Record daily form:", user); // Log user on page load

  if (!user) {
    navigate("/login");  // Redirect to login if user is not found
  }
}, [navigate]);
  useEffect(() => {
    fetchDropdownData();
  }, []);

  // Add new enquiry field
  const addEnquiryField = () => {
    setEnquiries([
      ...enquiries,
      {
        name: "",
        contactNo: "",
        preferredLocation: "",
        propertyName: "",
        noOfPeople: "",
        status: "Open",
        source: "",
        feedback: "",
      },
    ]);
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
    
    try {
    if (dailyEntryToEdit) {
      // ----------------------------
      // EDIT CASE
      // ----------------------------
      // Only one entry is being edited
      const updatedEntry = { ...dailyEntryToEdit, ...enquiries[0] };

      const response = await fetch(
        `${config.BASE_URL}/api/booking-enquiry/${dailyEntryToEdit.id}`,
        {
          method: "PUT",
          headers: config.getHeaders(),
          body: JSON.stringify(updatedEntry),
        }
      );

      if (!response.ok) throw new Error("Failed to update entry");

      alert("Entry updated successfully!");
       navigate("/user/daily-entries", { state: { openDailyEntries: true } });
    } else{
      const response = await fetch(`${config.BASE_URL}/api/booking-enquiry/bulk`, {
          method: "POST",
          headers: config.getHeaders(),
          body: JSON.stringify(enquiries),
        });


      if (!response.ok) throw new Error("Failed to save data");

      const savedData = await response.json();
      alert("Entries saved successfully!");

      navigate("/user/daily-entries", { state: { openDailyEntries: true } });
    } 
  }catch (err) {
      console.error("Error saving entries:", err);
      alert("Error saving entries. Please try again.");
    }
  };

  return (
    <>
        {/* Header */}
          <h2 className="page-title">
            {dailyEntryToEdit ? "Edit Daily Entry" : "Record Daily Entry"}
          </h2>
        {/* Form */}
        <form onSubmit={handleSubmit} className="daily-entry-form">
          <div className="enquiries-container">
            {enquiries.map((enquiry, index) => (
              <div key={index} className="enquiry-entry">
                <h3>Enquiry {index + 1}</h3>

                <div className="form-row">
                  <div className="form-group">
                    <label>Customer Name</label>
                    <input
                      type="text"
                      name="name"
                      value={enquiry.name}
                      onChange={(e) => handleEnquiryChange(e, index)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Contact No</label>
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

                  </div>
                </div>

               <div className="form-row">
  <div className="form-group">
    <label>Preferred Location</label>
    <Select
  className="react-select"
  classNamePrefix="react-select"
  options={dropdownOptions.locations.map(loc => ({
    value: loc,
    label: loc
  }))}
  value={
    enquiry.preferredLocation
      ? {
          value: enquiry.preferredLocation,
          label: enquiry.preferredLocation
        }
      : null
  }
  onChange={(selected) =>
    handleEnquiryChange(
      {
        target: {
          name: "preferredLocation",
          value: selected ? selected.value : ""
        }
      },
      index
    )
  }
/>
  </div>

  <div className="form-group">
    <label>Property Name</label>
<Select
  classNamePrefix="react-select"
  placeholder="Select Property"
  options={dropdownOptions.properties.map((prop) => ({
    value: prop.name,
    label: prop.name,
  }))}
  value={
    dropdownOptions.properties
      .map((prop) => ({
        value: prop.name,
        label: prop.name,
      }))
      .find((option) => option.value === enquiry.propertyName) || null
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
  </div>
</div>

<div className="form-row">
  <div className="form-group">
    <label>Enquiry Source</label>
<Select
  classNamePrefix="react-select"
  placeholder="Select Source"
  options={dropdownOptions.sources.map((source) => ({
    value: source,
    label: source,
  }))}
  value={
    dropdownOptions.sources
      .map((source) => ({
        value: source,
        label: source,
      }))
      .find((option) => option.value === enquiry.source) || null
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
  </div>

  <div className="form-group">
    <label>No of People</label>
    <input
      type="number"
      name="noOfPeople"
      value={enquiry.noOfPeople}
      onChange={(e) => handleEnquiryChange(e, index)}
    />
  </div>
</div>

                <div className="form-group">
                  <label>Feedback</label>
                  <input
                    type="text"
                    name="feedback"
                    value={enquiry.feedback}
                    onChange={(e) => handleEnquiryChange(e, index)}
                  />
                </div>

                {enquiries.length > 1 && (
                  <button
                    type="button"
                    className="remove-btn"
                    onClick={() => removeEnquiryField(index)}
                  >
                    Remove Enquiry
                  </button>
                )}
              </div>
            ))}

            <button type="button" className="add-btn" onClick={addEnquiryField}>
              Add Another Enquiry
            </button>
          </div>

          <button type="submit" className="submit-btn">
            {dailyEntryToEdit ? "Update Entries" : "Record Entries"}
          </button>
        </form>
      </>
  );
};

export default RecordDailyEntryForm;
