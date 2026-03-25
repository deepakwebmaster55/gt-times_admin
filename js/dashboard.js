(function () {
  const statusEl = document.querySelector("[data-dashboard-status]");
  const rangeSelects = Array.from(document.querySelectorAll("[data-dashboard-range]"));
  const pendingRangeSelect = document.querySelector("[data-pending-range]");
  const receivedRangeSelect = document.querySelector("[data-received-range]");
  const refreshBtn = document.querySelector("[data-admin-refresh]");

  const state = {
    bookings: [],
    items: [],
    payments: [],
    profiles: [],
    contacts: [],
    contactSource: null
  };

  const setStatus = (message, isError) => {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.style.color = isError ? "#ff8b8b" : "";
  };

  const formatCurrency = (value) => `Rs. ${Math.round(Number(value || 0)).toLocaleString()}`;
  const formatNumber = (value) => Number(value || 0).toLocaleString();

  const parseDate = (value) => {
    const date = value ? new Date(value) : null;
    return Number.isNaN(date?.getTime?.()) ? null : date;
  };

  const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const daysAgo = (days) => {
    const now = new Date();
    const date = startOfDay(now);
    date.setDate(date.getDate() - (days - 1));
    return date;
  };

  const isWithinDays = (value, days) => {
    const date = parseDate(value);
    if (!date) return false;
    return date >= daysAgo(days);
  };

  const getStatusDate = (booking) => booking?.updated_at || booking?.created_at || null;

  const groupSeries = (days, getValue, source) => {
    const start = daysAgo(days);
    const map = new Map();
    for (let index = 0; index < days; index += 1) {
      const bucket = new Date(start);
      bucket.setDate(start.getDate() + index);
      const key = bucket.toISOString().slice(0, 10);
      map.set(key, 0);
    }

    source.forEach((entry) => {
      const date = parseDate(entry.created_at);
      if (!date || date < start) return;
      const key = startOfDay(date).toISOString().slice(0, 10);
      if (!map.has(key)) return;
      map.set(key, Number(map.get(key) || 0) + Number(getValue(entry) || 0));
    });

    return Array.from(map.entries()).map(([key, value]) => ({
      key,
      label: new Date(key).toLocaleDateString(undefined, { day: "numeric", month: "short" }),
      value
    }));
  };

  const paymentMap = () => {
    const map = new Map();
    state.payments.forEach((payment) => {
      map.set(payment.booking_id, payment);
    });
    return map;
  };

  const itemMap = () => {
    const map = new Map();
    state.items.forEach((item) => {
      const list = map.get(item.booking_id) || [];
      list.push(item);
      map.set(item.booking_id, list);
    });
    return map;
  };

  const profileMap = () => {
    const map = new Map();
    state.profiles.forEach((profile) => {
      map.set(profile.id, profile);
    });
    return map;
  };

  const isPendingPayment = (payment) => {
    const status = String(payment?.status || "").toLowerCase();
    return !status || status === "payment_pending";
  };

  const isPaid = (payment) => String(payment?.status || "").toLowerCase() === "payment_received";
  const isCancelled = (booking) => String(booking?.status || "").toLowerCase() === "cancelled";
  const isShipped = (booking) => ["shipped", "out_for_delivery"].includes(String(booking?.status || "").toLowerCase());
  const isDelivered = (booking) => String(booking?.status || "").toLowerCase() === "delivered";

  const sumItemQuantity = (bookingId, itemsByBooking) => {
    return (itemsByBooking.get(bookingId) || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  };

  const setText = (selector, value) => {
    const el = document.querySelector(selector);
    if (el) el.textContent = value;
  };

  const linePath = (points) => {
    return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  };

  const areaPath = (points, height) => {
    if (!points.length) return "";
    return `${linePath(points)} L ${points[points.length - 1].x} ${height - 24} L ${points[0].x} ${height - 24} Z`;
  };

  const renderChart = (selector, series, options = {}) => {
    const host = document.querySelector(selector);
    if (!host) return;

    if (!series.length || series.every((item) => Number(item.value || 0) === 0)) {
      host.innerHTML = `<div class="chart-empty">${options.emptyLabel || "No data in this range."}</div>`;
      return;
    }

    const width = 720;
    const height = 240;
    const paddingX = 26;
    const paddingTop = 20;
    const paddingBottom = 24;
    const maxValue = Math.max(...series.map((item) => Number(item.value || 0)), 1);
    const innerWidth = width - paddingX * 2;
    const innerHeight = height - paddingTop - paddingBottom;
    const step = series.length > 1 ? innerWidth / (series.length - 1) : innerWidth;
    const points = series.map((item, index) => ({
      x: paddingX + step * index,
      y: paddingTop + innerHeight - (Number(item.value || 0) / maxValue) * innerHeight
    }));

    host.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" class="chart-svg" role="img" aria-label="${options.label || "Dashboard chart"}">
        <defs>
          <linearGradient id="${selector.replace(/[^a-z0-9]/gi, "")}Gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${options.color || "#4bf0ff"}" stop-opacity="0.42"></stop>
            <stop offset="100%" stop-color="${options.color || "#4bf0ff"}" stop-opacity="0"></stop>
          </linearGradient>
        </defs>
        <g class="chart-grid">
          ${Array.from({ length: 4 }).map((_, index) => {
            const y = paddingTop + (innerHeight / 3) * index;
            const value = Math.round(maxValue - (maxValue / 3) * index);
            return `
              <line x1="${paddingX}" y1="${y}" x2="${width - paddingX}" y2="${y}"></line>
              <text x="${paddingX - 8}" y="${y + 4}" text-anchor="end">${value.toLocaleString()}</text>
            `;
          }).join("")}
        </g>
        <path d="${areaPath(points, height)}" fill="url(#${selector.replace(/[^a-z0-9]/gi, "")}Gradient)"></path>
        <path d="${linePath(points)}" fill="none" stroke="${options.color || "#4bf0ff"}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></path>
        ${points.map((point, index) => `
          <g>
            <circle cx="${point.x}" cy="${point.y}" r="4.5" fill="${options.color || "#4bf0ff"}"></circle>
            <title>${series[index].label}: ${Number(series[index].value || 0).toLocaleString()}</title>
          </g>
        `).join("")}
        ${series.filter((_, index) => {
          if (series.length <= 8) return true;
          const every = Math.ceil(series.length / 6);
          return index % every === 0 || index === series.length - 1;
        }).map((item, index, filtered) => {
          const originalIndex = series.indexOf(item);
          const point = points[originalIndex];
          return `<text x="${point.x}" y="${height - 4}" text-anchor="${filtered.length - 1 === index ? "end" : "middle"}">${item.label}</text>`;
        }).join("")}
      </svg>
    `;
  };

  const renderAlerts = (overdueRows) => {
    const host = document.querySelector("[data-overdue-alerts]");
    if (!host) return;
    if (!overdueRows.length) {
      host.innerHTML = `<div class="alert-item"><strong>No overdue payments</strong><span class="small">Nothing older than 30 days is pending right now.</span></div>`;
      return;
    }

    host.innerHTML = overdueRows.map((row) => `
      <div class="alert-item is-danger">
        <strong>${row.order_number || row.id.slice(0, 8)}</strong>
        <span>${row.customer || "Unknown customer"}</span>
        <span>${formatCurrency(row.total_amount)}</span>
        <span>${row.ageDays} days pending</span>
      </div>
    `).join("");
  };

  const loadContactsFallback = async () => {
    if (!window.gtSupabase3) return { contacts: [], source: null };
    try {
      const { data, error } = await window.gtSupabase3
        .from("contact_submissions")
        .select("id, created_at")
        .order("created_at", { ascending: false });
      if (error) {
        console.warn("Contact fallback query failed.", error);
        return { contacts: [], source: null };
      }
      return {
        contacts: data || [],
        source: "contact_submissions"
      };
    } catch (error) {
      console.warn("Contact fallback query threw.", error);
      return { contacts: [], source: null };
    }
  };

  const renderDashboard = () => {
    const mainDays = Number(rangeSelects[0]?.value || 30);
    const pendingDays = Number(pendingRangeSelect?.value || 30);
    const receivedDays = Number(receivedRangeSelect?.value || 30);

    const paymentsByBooking = paymentMap();
    const itemsByBooking = itemMap();
    const profilesById = profileMap();

    const mainBookings = state.bookings.filter((booking) => isWithinDays(booking.created_at, mainDays));
    const receivedBookings = state.bookings.filter((booking) => isWithinDays(getStatusDate(booking), receivedDays) && isDelivered(booking));
    const pendingBookings = state.bookings.filter((booking) => {
      if (!isWithinDays(booking.created_at, pendingDays)) return false;
      return isPendingPayment(paymentsByBooking.get(booking.id));
    });

    const soldUnits = mainBookings.reduce((sum, booking) => sum + sumItemQuantity(booking.id, itemsByBooking), 0);
    const paidRevenue = mainBookings.reduce((sum, booking) => {
      const payment = paymentsByBooking.get(booking.id);
      return sum + (isPaid(payment) ? Number(payment.amount || booking.total_amount || 0) : 0);
    }, 0);
    const todayRevenue = state.bookings.reduce((sum, booking) => {
      const payment = paymentsByBooking.get(booking.id);
      if (!isPaid(payment) || !isWithinDays(booking.created_at, 1)) return sum;
      return sum + Number(payment.amount || booking.total_amount || 0);
    }, 0);
    const cancelledOrders = state.bookings.filter((booking) => isCancelled(booking) && isWithinDays(getStatusDate(booking), mainDays)).length;
    const shippedOrders = state.bookings.filter((booking) => isShipped(booking) && isWithinDays(getStatusDate(booking), mainDays)).length;
    const deliveredOrders = receivedBookings.length;
    const contactCount = state.contacts.filter((contact) => isWithinDays(contact.created_at, mainDays)).length;

    setText("[data-kpi-products-sold]", formatNumber(soldUnits));
    setText("[data-kpi-products-sold-meta]", `${mainDays} day view`);
    setText("[data-kpi-revenue]", formatCurrency(paidRevenue));
    setText("[data-kpi-revenue-meta]", `${mainDays} day paid total`);
    setText("[data-kpi-contacts]", state.contactSource ? formatNumber(contactCount) : "N/A");
    setText("[data-kpi-contacts-meta]", state.contactSource ? `${mainDays} day contact submissions` : "Contact form is not stored in Supabase yet");
    setText("[data-kpi-cancelled]", formatNumber(cancelledOrders));
    setText("[data-kpi-cancelled-meta]", `${mainDays} day cancellation count`);
    setText("[data-kpi-shipped]", formatNumber(shippedOrders));
    setText("[data-kpi-shipped-meta]", `${mainDays} day shipped + out for delivery`);
    setText("[data-kpi-received]", formatNumber(deliveredOrders));
    setText("[data-kpi-received-meta]", `${receivedDays} day received window`);

    setText("[data-chart-products-value]", `${formatNumber(soldUnits)} units`);
    setText("[data-chart-profit-value]", formatCurrency(paidRevenue));
    setText("[data-chart-contacts-value]", state.contactSource ? formatNumber(contactCount) : "N/A");
    setText("[data-chart-cancelled-value]", formatNumber(cancelledOrders));
    setText("[data-chart-shipped-value]", formatNumber(shippedOrders));
    setText("[data-chart-pending-value]", formatNumber(pendingBookings.length));
    setText("[data-chart-received-value]", formatNumber(deliveredOrders));
    setText("[data-profit-note]", `Today's sale: ${formatCurrency(todayRevenue)}`);

    renderChart("[data-chart-products]", groupSeries(mainDays, (booking) => sumItemQuantity(booking.id, itemsByBooking), state.bookings), {
      label: "Products sold trend",
      color: "#4bf0ff",
      emptyLabel: "No sold products in this time range."
    });

    renderChart("[data-chart-contacts]", groupSeries(mainDays, () => 1, state.contacts), {
      label: "Contact submission trend",
      color: "#73ffb8",
      emptyLabel: state.contactSource ? "No contact submissions in this range." : "No contact table found. Contact form currently posts to Formspree."
    });

    renderChart("[data-chart-profit]", groupSeries(mainDays, (booking) => {
      const payment = paymentsByBooking.get(booking.id);
      return isPaid(payment) ? Number(payment.amount || booking.total_amount || 0) : 0;
    }, state.bookings), {
      label: "Sales revenue trend",
      color: "#a98bff",
      emptyLabel: "No paid sales in this time range."
    });

    renderChart("[data-chart-cancelled]", groupSeries(mainDays, (booking) => {
      if (!isCancelled(booking)) return 0;
      return isWithinDays(getStatusDate(booking), mainDays) ? 1 : 0;
    }, state.bookings.map((booking) => ({ ...booking, created_at: getStatusDate(booking) }))), {
      label: "Cancelled orders trend",
      color: "#ff7b93",
      emptyLabel: "No cancelled orders in this time range."
    });

    renderChart("[data-chart-shipped]", groupSeries(mainDays, (booking) => {
      if (!isShipped(booking)) return 0;
      return isWithinDays(getStatusDate(booking), mainDays) ? 1 : 0;
    }, state.bookings.map((booking) => ({ ...booking, created_at: getStatusDate(booking) }))), {
      label: "Shipped order trend",
      color: "#6d94ff",
      emptyLabel: "No shipped or out-for-delivery orders in this time range."
    });

    renderChart("[data-chart-pending]", groupSeries(pendingDays, (booking) => {
      const payment = paymentsByBooking.get(booking.id);
      return isPendingPayment(payment) ? 1 : 0;
    }, state.bookings), {
      label: "Pending payment order trend",
      color: "#ffd166",
      emptyLabel: "No pending payments in this time range."
    });

    renderChart("[data-chart-received]", groupSeries(receivedDays, (booking) => {
      if (!isDelivered(booking)) return 0;
      return isWithinDays(getStatusDate(booking), receivedDays) ? 1 : 0;
    }, state.bookings.map((booking) => ({ ...booking, created_at: getStatusDate(booking) }))), {
      label: "Received orders trend",
      color: "#38d7a3",
      emptyLabel: "No delivered orders in this time range."
    });

    const overdueRows = state.bookings
      .map((booking) => {
        const payment = paymentsByBooking.get(booking.id);
        const createdAt = parseDate(booking.created_at);
        const ageDays = createdAt ? Math.floor((Date.now() - createdAt.getTime()) / 86400000) : 0;
        return {
          ...booking,
          ageDays,
          customer: profilesById.get(booking.user_id)?.full_name || profilesById.get(booking.user_id)?.email || "",
          isOverdue: isPendingPayment(payment) && ageDays > 30
        };
      })
      .filter((row) => row.isOverdue)
      .sort((a, b) => b.ageDays - a.ageDays);

    setText("[data-overdue-count]", `${formatNumber(overdueRows.length)} alerts`);
    renderAlerts(overdueRows);

    const shippedOnly = state.bookings.filter((booking) => String(booking.status || "").toLowerCase() === "shipped").length;
    const outForDelivery = state.bookings.filter((booking) => String(booking.status || "").toLowerCase() === "out_for_delivery").length;
    const deliveredTotal = state.bookings.filter(isDelivered).length;
    const paidTotal = state.bookings.filter((booking) => isPaid(paymentsByBooking.get(booking.id))).length;
    const cancelledTotal = state.bookings.filter(isCancelled).length;

    setText("[data-summary-pending]", formatNumber(pendingBookings.length));
    setText("[data-summary-shipped]", formatNumber(shippedOnly));
    setText("[data-summary-out]", formatNumber(outForDelivery));
    setText("[data-summary-delivered]", formatNumber(deliveredTotal));
    setText("[data-summary-paid]", formatNumber(paidTotal));
    setText("[data-summary-cancelled]", formatNumber(cancelledTotal));

    const contactText = state.contactSource
      ? `Contact source: ${state.contactSource}`
      : "Contact form currently posts to Formspree and is not stored in Supabase.";
    setStatus(`Dashboard ready. ${contactText}`);
  };

  const loadDashboard = async () => {
    if (!window.callSupabase3AdminFunction) {
      setStatus("Supabase 3 functions not configured.", true);
      return;
    }

    window.setAdminLoading?.(true);
    setStatus("Loading dashboard data...");

    try {
      const token = await window.getAdminAccessToken?.();
      const response = await window.callSupabase3AdminFunction("admin-bookings", {}, token);
      if (response?.error) {
        setStatus(response.error, true);
        return;
      }

      state.bookings = response.bookings || [];
      state.items = response.items || [];
      state.payments = response.payments || [];
      state.profiles = response.profiles || [];
      state.contacts = response.contacts || [];
      state.contactSource = response.contact_source || null;

      if (!state.contactSource) {
        const fallback = await loadContactsFallback();
        if (fallback.source) {
          state.contacts = fallback.contacts;
          state.contactSource = fallback.source;
        }
      }

      renderDashboard();
    } catch (error) {
      setStatus(error.message || "Failed to load dashboard.", true);
    } finally {
      window.setAdminLoading?.(false);
    }
  };

  rangeSelects.forEach((select) => {
    select.addEventListener("change", () => {
      rangeSelects.forEach((target) => {
        if (target !== select) target.value = select.value;
      });
      renderDashboard();
    });
  });

  [pendingRangeSelect, receivedRangeSelect].forEach((field) => {
    field?.addEventListener("change", renderDashboard);
  });

  refreshBtn?.addEventListener("click", loadDashboard);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadDashboard);
  } else {
    loadDashboard();
  }
})();
