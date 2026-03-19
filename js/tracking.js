(function () {
  const orderStatuses = [
    { value: "order_placed", label: "Order Placed", step: 1 },
    { value: "confirmed", label: "Confirmed", step: 2 },
    { value: "packed", label: "Packed", step: 3 },
    { value: "shipped", label: "Shipped", step: 4 },
    { value: "out_for_delivery", label: "Out For Delivery", step: 5 },
    { value: "delivered", label: "Delivered", step: 6 },
    { value: "cancelled", label: "Cancelled", step: -1 }
  ];

  const paymentStatuses = [
    { value: "payment_pending", label: "Payment Pending" },
    { value: "payment_received", label: "Payment Received" },
    { value: "payment_failed", label: "Payment Failed" },
    { value: "refunded", label: "Refunded" }
  ];

  const orderMap = new Map(orderStatuses.map((item) => [item.value, item]));
  const paymentMap = new Map(paymentStatuses.map((item) => [item.value, item]));

  const getOrderLabel = (status) => orderMap.get(status)?.label || "Pending";
  const getPaymentLabel = (status) => paymentMap.get(status)?.label || "Payment Pending";

  const getOrderBadgeClass = (status) => {
    if (status === "delivered") return "success";
    if (status === "cancelled") return "danger";
    if (status === "shipped" || status === "out_for_delivery") return "info";
    return "pending";
  };

  const getPaymentBadgeClass = (status) => {
    if (status === "payment_received") return "success";
    if (status === "payment_failed" || status === "refunded") return "danger";
    return "pending";
  };

  const getTrackingSteps = (status) => {
    const currentStep = orderMap.get(status)?.step || 1;
    return orderStatuses
      .filter((item) => item.step > 0)
      .map((item) => ({
        ...item,
        done: currentStep >= item.step,
        active: currentStep === item.step
      }));
  };

  window.GTTracking = {
    orderStatuses,
    paymentStatuses,
    getOrderLabel,
    getPaymentLabel,
    getOrderBadgeClass,
    getPaymentBadgeClass,
    getTrackingSteps
  };
})();
