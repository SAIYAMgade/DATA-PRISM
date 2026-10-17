import csv
import random
from datetime import datetime, timedelta
from pathlib import Path

SAMPLE_PRODUCTS = [
    ("85123A", "WHITE HANGING HEART T-LIGHT HOLDER", 2.55),
    ("71053", "WHITE METAL LANTERN", 3.39),
    ("84406B", "CREAM CUPID HEARTS COAT HANGER", 2.75),
    ("84029G", "KNITTED UNION FLAG HOT WATER BOTTLE", 3.39),
    ("84029E", "RED WOOLLY HOTTIE WHITE HEART.", 3.39),
    ("22752", "SET 7 BABUSHKA NESTING BOXES", 7.65),
    ("21730", "GLASS STAR FROSTED T-LIGHT HOLDER", 4.25),
    ("22632", "HAND WARMER RED RETROSPOT", 1.85),
    ("22633", "HAND WARMER UNION JACK", 1.85),
    ("22111", "SCOTTIE DOG HOT WATER BOTTLE", 4.95),
    ("22086", "PAPER CHAIN KIT 50'S CHRISTMAS", 2.55),
    ("22423", "REGENCY CAKESTAND 3 TIER", 12.75),
    ("21523", "DOORMAT FANCY FONT HOME SWEET HOME", 6.75),
    ("22384", "LUNCH BAG PINK POLKADOT", 1.65),
    ("20725", "LUNCH BAG RED RETROSPOT", 1.65),
    ("22382", "LUNCH BAG SPACEBOY DESIGN", 1.65),
    ("22383", "LUNCH BAG SUKI DESIGN", 1.65),
    ("22386", "JUMBO BAG PINK POLKADOT", 1.95),
    ("85099B", "JUMBO BAG RED RETROSPOT", 1.95),
    ("21931", "JUMBO STORAGE BAG SUKI", 1.95)
]

COUNTRIES = [
    ("United Kingdom", 0.85),
    ("Germany", 0.04),
    ("France", 0.04),
    ("EIRE", 0.03),
    ("Spain", 0.02),
    ("Netherlands", 0.01),
    ("Australia", 0.01)
]

def choose_country():
    r = random.random()
    cumulative = 0.0
    for country, weight in COUNTRIES:
        cumulative += weight
        if r <= cumulative:
            return country
    return "United Kingdom"

def generate_retail_dataset(output_csv: Path, num_records: int = 5000):
    output_csv.parent.mkdir(parents=True, exist_ok=True)
    random.seed(42)
    start_date = datetime(2025, 1, 1, 8, 30)
    
    customers = [f"{random.randint(12344, 18287)}" for _ in range(400)]
    invoices = []
    
    # Generate batch of sequential invoice numbers
    curr_invoice_num = 489434
    
    rows = []
    for _ in range(num_records):
        invoice_date = start_date + timedelta(
            days=random.randint(0, 360),
            hours=random.randint(0, 10),
            minutes=random.randint(0, 59)
        )
        
        # 10% chance to reuse previous invoice, else advance
        if not invoices or random.random() > 0.35:
            curr_invoice_num += 1
            is_cancellation = random.random() < 0.04
            prefix = "C" if is_cancellation else ""
            inv_str = f"{prefix}{curr_invoice_num}"
            invoices.append((inv_str, is_cancellation))
        else:
            inv_str, is_cancellation = invoices[-1]

        code, desc, base_price = random.choice(SAMPLE_PRODUCTS)
        
        # Determine quantity
        if is_cancellation:
            qty = -random.randint(1, 12)
        else:
            # 1% chance of bulk wholesale order
            if random.random() < 0.01:
                qty = random.randint(100, 800)
            else:
                qty = random.randint(1, 24)

        # 15% chance CustomerID is missing (guest checkout - real characteristic of UCI dataset)
        cust_id = random.choice(customers) if random.random() > 0.15 else ""
        
        # Price fluctuations
        price = round(base_price * (1.0 + random.uniform(-0.05, 0.05)), 2)
        country = choose_country()

        rows.append([
            inv_str,
            code,
            desc,
            qty,
            invoice_date.strftime("%Y-%m-%d %H:%M:%S"),
            price,
            cust_id,
            country
        ])

    with open(output_csv, mode="w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["Invoice", "StockCode", "Description", "Quantity", "InvoiceDate", "Price", "CustomerID", "Country"])
        writer.writerows(rows)
        
    print(f"Generated {len(rows)} UCI Online Retail II records at {output_csv}")

if __name__ == "__main__":
    out_path = Path(__file__).resolve().parent.parent / "data" / "sample" / "online_retail_ii.csv"
    generate_retail_dataset(out_path)
