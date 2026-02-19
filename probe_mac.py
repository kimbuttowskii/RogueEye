
import asyncio
import inspect
from mac_vendor_lookup import MacLookup, AsyncMacLookup

print(f"MacLookup type: {MacLookup}")
try:
    m = MacLookup()
    print("MacLookup initialized")
    
    uv = m.update_vendors()
    print(f"update_vendors returned: {type(uv)}")
    if inspect.iscoroutine(uv):
        print("It IS a coroutine!")
except Exception as e:
    print(f"Error: {e}")
