const fs = require("fs");

function searchSpace(jsonParsed, searchBuffer, result) {
  const current = searchBuffer.pop();
  if (result[current.key]) {
    return;
  }

  result[current.key] = current.data;
  searchData(jsonParsed, current.data, searchBuffer, result);
}

function searchData(jsonParsed, data, searchBuffer, result) {
  if (!data) {
    return;
  }

  for (const k of Object.keys(data)) {
    if (k === "$ref") {
      const foundKey = data[k].split("/").at(-1);
      if (!result[foundKey]) {
        searchBuffer.push({
          key: foundKey,
          data: jsonParsed.components.schemas[foundKey],
        });
      }

      continue;
    }

    if (typeof data[k] === "object") {
      searchData(jsonParsed, data[k], searchBuffer, result);
    }
  }
}

function generateSchema(jsonParsed, start) {
  const searchBuffer = [
    { key: start, data: jsonParsed.components.schemas[start] },
  ];
  const jsonSchema = {};
  do {
    searchSpace(jsonParsed, searchBuffer, jsonSchema);
  } while (searchBuffer.length > 0);

  return {
    "$schema": "http://json-schema.org/draft-04/schema#",
    "$ref": `#/components/schemas/${start}`,
    components: {
      schemas: jsonSchema
    }
  };
}

console.debug("Starting");

const fetchData = async (useCache, save, fetchUrl) => {
  console.debug("Reading swagger.json from file");
  const str = fs.readFileSync("./generated_swagger.json", "utf-8");
  return JSON.parse(str);
};

const useCache = process.argv.includes('--cache') || process.argv.includes('-c');
const save = process.argv.includes('--save') || process.argv.includes('-s');
const fetchUrl = "https://mmp-int.beapi.ud4d.com/swagger/v1/swagger.json";
const help = process.argv.includes('--help') || process.argv.includes('-h');

if (help) {
  console.log(`Program arguments:
  --cache (use swagger.json from cache ./generated/swagger.json)
  --save (save swagger.json after fetch to ./generated/swagger.json)
  --help (prints help)`);
  return;
}

fetchData(useCache, save, fetchUrl).then((data) => {
  console.debug("Generating template schema");
  const templateSchema = JSON.stringify(
    generateSchema(data, "MainDatabaseTemplate"),
    undefined,
    2
  );
  console.debug("Finished generating template schema");

  console.debug("Generating package schema");
  const packageSchema = JSON.stringify(
    generateSchema(data, "PkgContentRootVM"),
    undefined,
    2
  );
  console.debug("Finished generating package schema");

  console.debug("Writing template schema to ./generated/template-schema.json");
  fs.writeFileSync("./generated/template-schema.json", templateSchema);
  console.debug("Finished writing template schema");

  console.debug("Writing package schema to ./generated/package-schema.json");
  fs.writeFileSync("./generated/package-schema.json", packageSchema);
  console.debug("Finished writing package schema");

  console.debug("Finished");
});
