# Product image uploads

Product images are kept in the root-level `Assets1`, `Assets2`, and `Assets3`
folders, outside `Assets`. Upload or update these folders separately; each
contains fewer than 100 image files.

| Folder | Product IDs | Image files |
| --- | --- | ---: |
| `Assets1` | 83–98 | 74 |
| `Assets2` | 99–177 | 50 |
| `Assets3` | 178 and above | 77 |

Keep each product's images together under `images/products/<product-ID>/`.
The image path builder in `js/script.js` selects a folder from the product ID
range; update it if you change the ranges or add a new folder.
