$f = "c:\elipseProject\dashboard\qistmarket-app-dashboard\src\components\CustomerList\CustomerList.tsx"
$bytes = [System.IO.File]::ReadAllBytes($f)
$text = [System.Text.Encoding]::UTF8.GetString($bytes)

# Show current state
$lines = $text -split "`n"
Write-Host "Total lines: $($lines.Count)"

# Use regex to find and remove all garbled multi-byte sequences
# Garbled emoji pattern: sequences like 'dY' followed by non-ASCII chars
# Strategy: use regex to replace icon field strings and emoji patterns

# 1. Fix icon field in tab rendering - remove <span>{tab.icon}</span>
$text = $text -replace '<span>\{tab\.icon\}</span>', ''

# 2. Remove icon property from tab type and usage using regex
# The icon values are sequences of bytes that form garbled text - 
# use a broad pattern to remove them
$text = [regex]::Replace($text, "icon: '[^']{1,20}',", '')
$text = [regex]::Replace($text, "icon: '[^']{1,20}' \}", ' }')

# 3. Fix the tab type definition to remove icon
$text = $text -replace '\{ id: ProfileTab; label: string; icon: string \}', '{ id: ProfileTab; label: string }'

# 4. Remove inline emoji in JSX - patterns like emoji followed by space+text
# Replace 3-4 byte garbled sequences (appear as 3-6 chars with high-byte chars)
# by removing just the garbled part before known text
$text = [regex]::Replace($text, '\x{FFFD}[^A-Za-z<{]*(?=[A-Z])', '')

# 5. Clean up doubled spaces
$text = $text -replace '  +', ' '

[System.IO.File]::WriteAllText($f, $text, (New-Object System.Text.UTF8Encoding $false))
Write-Host "Done. File size: $((Get-Item $f).Length)"
