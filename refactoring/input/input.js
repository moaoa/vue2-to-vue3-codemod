import { ElInput } from "element-plus";
import axiosInstance from "@/axios/main";
import matmatices from "functions/mathematics";
import showErrorMessage from "functions/showErrorMessage";

export default {
  components: {
    ElInput,
  },
  data() {
    return {
      RawTableData: [],
      TableData: [],
      newTbleData: [],
      search: "",
      SearchBox: "",
    };
  },

  watch: {
    SearchBox(Search) {
      if (Search === "") {
        this.TableData = Object.assign(this.RawTableData);
      } else {
        this.TableData = [];
        this.RawTableData.forEach((element) => {
          if (element.name.toLowerCase().includes(Search.toLowerCase())) {
            this.TableData.push(element);
          }
        });
      }
    },
  },

  async created() {
    this.getTable();
  },

  methods: {
    addcomalyd(value) {
      return matmatices.FormatasLYD(value);
    },
    AddcomaUSD(value) {
      return matmatices.FormatasUSD(value);
    },
    async getTable() {
      try {
        let result = await axiosInstance.get(
          `/api/management/v1.0/suppliers/get-balance`
        );
        result.data.data.forEach((element) => {
          if (element.actualBalance !== null) {
            this.TableData.push({
              name: element.name,
              value:
                element.currency === 2
                  ? this.AddcomaUSD(element.actualBalance)
                  : this.addcomalyd(element.actualBalance),
              footerText:
                element.currency === 2
                  ? this.AddcomaUSD(element.estimatedBalance)
                  : this.addcomalyd(element.estimatedBalance),
            });
          } else {
            this.TableData.push({
              name: element.name,
              value: "unavailable",
              footerText:
                element.currency === 2
                  ? this.AddcomaUSD(element.estimatedBalance)
                  : this.addcomalyd(element.estimatedBalance),
            });
          }
        });
        this.TableData.sort(function (a, b) {
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
        this.RawTableData = this.TableData;
      } catch (error) {
        showErrorMessage(error);
      }
    },
  },
};
