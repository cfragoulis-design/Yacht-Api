const API_URL = "https://yacht-api-production.up.railway.app";

export async function createOrder(orderData) {
  const response = await fetch(`${API_URL}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(orderData),
  });

  return response.json();
}

export async function getYachts() {
  const response = await fetch(`${API_URL}/yachts`);
  return response.json();
}
