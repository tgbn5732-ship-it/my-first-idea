import os
from PIL import Image

# Path to the source sprite sheet
sprite_sheet_path = r"C:\Users\tgbnt\.gemini\antigravity\brain\51607de5-b2f1-49dc-955b-3c3908607170\mbti_spritesheet_1784431330328.png"

# Target directory
target_dir = r"c:\Users\tgbnt\MBTI연습\images"
if not os.path.exists(target_dir):
    os.makedirs(target_dir)

# MBTI grid layout (4x4)
mbti_grid = [
    ["ISTJ", "ISFJ", "INFJ", "INTJ"],
    ["ISTP", "ISFP", "INFP", "INTP"],
    ["ESTP", "ESFP", "ENFP", "ENTP"],
    ["ESTJ", "ESFJ", "ENFJ", "ENTJ"]
]

try:
    img = Image.open(sprite_sheet_path)
    width, height = img.size
    
    # Calculate cell sizes
    cell_width = width // 4
    cell_height = height // 4
    
    print(f"Original image size: {width}x{height}")
    print(f"Cell size: {cell_width}x{cell_height}")
    
    for row in range(4):
        for col in range(4):
            mbti_name = mbti_grid[row][col]
            
            # Define crop box (left, upper, right, lower)
            left = col * cell_width
            upper = row * cell_height
            right = (col + 1) * cell_width
            lower = (row + 1) * cell_height
            
            # Crop and save
            cell_img = img.crop((left, upper, right, lower))
            out_path = os.path.join(target_dir, f"{mbti_name}.png")
            cell_img.save(out_path)
            print(f"Saved: {out_path}")
            
    print("Slicing complete!")
except Exception as e:
    print(f"Error during slicing: {e}")
