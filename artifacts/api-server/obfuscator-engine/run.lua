local script_path = debug.getinfo(1, "S").source:sub(2):match("(.*[/%\\])")
package.path = script_path .. "?.lua;" .. package.path

local Prometheus = require("prometheus")

local source_file = arg[1]
local output_file = arg[2]
local preset_name = arg[3]
local lua_version = arg[4]
local pretty_print = arg[5] == "true"

local preset = Prometheus.Presets[preset_name]
if not preset then
    error("Unsupported preset: " .. tostring(preset_name))
end

local settings = {}
for key, value in pairs(preset) do
    settings[key] = value
end

settings.LuaVersion = lua_version
settings.PrettyPrint = pretty_print

local source_handle = assert(io.open(source_file, "rb"))
local source = source_handle:read("*a")
source_handle:close()

local pipeline = Prometheus.Pipeline:fromConfig(settings)
local result = pipeline:apply(source, "Hello Obfuscator input")

local output_handle = assert(io.open(output_file, "wb"))
output_handle:write(result)
output_handle:close()