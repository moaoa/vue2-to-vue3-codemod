import { ref, reactive, watch } from "vue";
import { ElInput } from "element-plus";
import axiosInstance from "@/axios/main";
import matmatices from "functions/mathematics";
import showErrorMessage from "functions/showErrorMessage";
const RawTableData = ref([]);
const TableData = ref([]);
const newTbleData = ref([]);
const search = ref("");
const SearchBox = ref("");
const addcomalyd = value => {
  return matmatices.FormatasLYD(value);
};
const AddcomaUSD = value => {
  return matmatices.FormatasUSD(value);
};
const getTable = async () => {
  try {
    let result = await axiosInstance.get(`/api/management/v1.0/suppliers/get-balance`);
    result.data.data.forEach(element => {
      if (element.actualBalance !== null) {
        TableData.value.push({
          name: element.name,
          value: element.currency === 2 ? AddcomaUSD(element.actualBalance) : addcomalyd(element.actualBalance),
          footerText: element.currency === 2 ? AddcomaUSD(element.estimatedBalance) : addcomalyd(element.estimatedBalance)
        });
      } else {
        TableData.value.push({
          name: element.name,
          value: "unavailable",
          footerText: element.currency === 2 ? AddcomaUSD(element.estimatedBalance) : addcomalyd(element.estimatedBalance)
        });
      }
    });
    TableData.value.sort(function (a, b) {
      const nameA = a.name.toUpperCase(); // ignore upper and lowercase
      const nameB = b.name.toUpperCase(); // ignore upper and lowercase
      if (nameA < nameB) {
        return -1;
      }
      if (nameA > nameB) {
        return 1;
      }

      // names must be equal
      return 0;
    });
    RawTableData.value = TableData.value;
  } catch (error) {
    showErrorMessage(error);
  }
};
watch(() => SearchBox, Search => {
  if (Search === "") {
    TableData.value = Object.assign(RawTableData.value);
  } else {
    TableData.value = [];
    RawTableData.value.forEach(element => {
      if (element.name.toLowerCase().includes(Search.toLowerCase())) {
        TableData.value.push(element);
      }
    });
  }
})
getTable();