export class OrdersDto {
  id: number;
  date: string;
  items: CartItem[];
  totalPrice: number;
}

export class CartItem {
  cartItemId: number;
  productName: string;
  price: number;
  quantity: number;
  subtotal: number;
}
