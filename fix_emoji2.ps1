$f = "c:\elipseProject\dashboard\qistmarket-app-dashboard\src\components\CustomerList\CustomerList.tsx"
$bytes = [System.IO.File]::ReadAllBytes($f)
$text = [System.Text.Encoding]::UTF8.GetString($bytes)

# Map of garbled sequence -> clean replacement (all in JSX context)
# These are the garbled bytes as they appear when read back as UTF-8
$map = @{
  # Phone/contact icons
  "dY`"z" = "Ph: "
  'dY"z' = "Ph: "
  # CNIC / ID
  'dY\ufffd' = "ID: "
  # Location
  'dY"?' = "Loc: "
  # Calendar
  'dY".' = ""
  # Person
  'dY`\u000f' = "Officer: "
  # Checkmark
  '\ufffd`\u006f"' = "[OK]"
  '\ufffd`\u006f.' = "OK"
  # Delivered
  '\ufffd`\u006f"' = "Delivered"
  # Bullet
  '\ufffd?\ufffd' = "-"
  # Running person 
  'dY?\ufffd' = ""
  # Shield
  'dY>\ufffd,?' = ""
  # Bell
  'dY""' = ""
  # Card
  "dY'3" = ""
  # Notepad
  'dY"?' = ""
  # Gas pump
  '\ufffd>\ufffd' = "Fuel: "
  # Walking
  'dYs\u0014' = ""
  # Calendar date
  'dY".' = "Date: "
  # Clock
  'dY\u0007?' = "Hours: "
  # Siren
  'dYs"' = ""
  # Alarm
  'dY"+ ' = ""
  # Bullet separator
  '\ufffd?\ufffd' = "/"
  # Online/offline circles
  '\ufffd-?' = "●"
  '\ufffd-<' = "○"
  # Ref separator
  '\ufffd?\ufffd' = "•"
}

# Simpler approach: use line-by-line targeted fixes
$lines = $text -split "`r?`n"
$fixed = @()
foreach ($line in $lines) {
  # Skip comment lines with garbled box-drawing (harmless)
  if ($line -match '^(\s*//)') {
    # Clean up box-drawing chars in comments
    $line = [regex]::Replace($line, '[\x80-\xFF\u0100-\uFFFF]+', '-')
    $line = $line -replace '-{3,}', '---'
    $fixed += $line
    continue
  }
  
  # Fix specific patterns in JSX
  # phone icon
  $line = [regex]::Replace($line, 'dY"z\s*', 'Ph: ')
  $line = [regex]::Replace($line, 'dY`\x0f\s*', '')
  $line = [regex]::Replace($line, 'dY"[.]\s*', '')
  $line = [regex]::Replace($line, 'dY"[?]\s*', '')
  $line = [regex]::Replace($line, 'dY[s][^A-Za-z"\s]*\s*', '')
  $line = [regex]::Replace($line, 'dY[?>][^A-Za-z"\s]*[,\s]*', '')
  $line = [regex]::Replace($line, 'dY[^A-Za-z"\s]{0,5}\s*', '')
  $line = [regex]::Replace($line, "[^A-Za-z\s]o[.\"]\s*", '')
  $line = [regex]::Replace($line, '[^\x00-\x7F\s]{2,}', '')
  $line = [regex]::Replace($line, '\?\x{0444}', '')
  
  $fixed += $line
}

$newText = $fixed -join "`r`n"
[System.IO.File]::WriteAllText($f, $newText, (New-Object System.Text.UTF8Encoding $false))
Write-Host "Done. Lines: $($fixed.Count), Size: $((Get-Item $f).Length)"
